import Capacitor
import SwiftUI

final class MushiverseBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MushiverseCoinPlugin())
    }
}

@objc(MushiverseCoinPlugin)
final class MushiverseCoinPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "MushiverseCoinPlugin"
    let jsName = "MushiverseCoins"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openShop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeShop", returnType: CAPPluginReturnPromise)
    ]
    private var shop: UIViewController?

    @objc func openShop(_ call: CAPPluginCall) {
        guard let token = call.getString("accessToken"), !token.isEmpty,
              let account = call.getString("userID"), let uuid = UUID(uuidString: account) else {
            call.reject("ログインが必要です")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self, let presenter = self.bridge?.viewController,
                  presenter.presentedViewController == nil else {
                call.reject("ショップを開けませんでした")
                return
            }
            let store = MushiverseCoinStore(
                creditEndpoint: URL(string: "https://jhowxtdemlsmetcwhekr.supabase.co/functions/v1/credit-apple-gacha-coins")!,
                accessToken: { token }, appAccountToken: { uuid }
            )
            let content = NavigationView {
                ScrollView { MushiverseCoinShopView(store: store, purchasesEnabled: MushiverseCoinStore.purchasesEnabled) }
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("閉じる") { self.shop?.dismiss(animated: true) }
                        }
                    }
            }
            let controller = UIHostingController(rootView: content.navigationViewStyle(.stack))
            self.shop = controller
            presenter.present(controller, animated: true) { call.resolve() }
        }
    }

    @objc func closeShop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.shop?.dismiss(animated: true)
            self?.shop = nil
            call.resolve()
        }
    }
}
