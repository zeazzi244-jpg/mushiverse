import Capacitor
import SwiftUI
import UIKit

final class MushiverseBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MushiverseCoinPlugin())
    }
}

@objc(MushiverseCoinPlugin)
final class MushiverseCoinPlugin: CAPPlugin, CAPBridgedPlugin, UIAdaptivePresentationControllerDelegate {
    let identifier = "MushiverseCoinPlugin"
    let jsName = "MushiverseCoins"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "openShop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "closeShop", returnType: CAPPluginReturnPromise)
    ]
    private weak var shop: UIViewController?
    private var store: MushiverseCoinStore?

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
            self.store = store
            let content = NavigationView {
                ScrollView { MushiverseCoinShopView(store: store, purchasesEnabled: MushiverseCoinStore.purchasesEnabled) }
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) {
                            Button("閉じる") { self.dismissShop() }
                        }
                    }
            }
            let controller = UIHostingController(rootView: content.navigationViewStyle(.stack))
            self.shop = controller
            controller.presentationController?.delegate = self
            presenter.present(controller, animated: true) {
                controller.presentationController?.delegate = self
                call.resolve()
            }
        }
    }

    @MainActor private func dismissShop() {
        store?.stop()
        store = nil
        shop?.dismiss(animated: true)
        shop = nil
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        DispatchQueue.main.async { [weak self] in self?.dismissShop() }
    }

    @objc func closeShop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.dismissShop()
            call.resolve()
        }
    }
}
