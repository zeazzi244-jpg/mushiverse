import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var launchOverlay: UIView?
    private var launchOverlayDismissal: DispatchWorkItem?
    private static let launchLogoDuration: TimeInterval = 1.8
    private static let launchFadeDuration: TimeInterval = 0.18

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        let appWindow = UIWindow(windowScene: windowScene)
        appWindow.rootViewController = CAPBridgeViewController()
        window = appWindow

        // Continue the system launch screen while Capacitor loads behind it.
        if let overlay = UIStoryboard(name: "LaunchScreen", bundle: nil).instantiateInitialViewController()?.view {
            overlay.frame = appWindow.bounds
            overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            overlay.accessibilityViewIsModal = true
            appWindow.addSubview(overlay)
            launchOverlay = overlay
        }

        appWindow.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        guard let overlay = launchOverlay, launchOverlayDismissal == nil else { return }
        let fadeDuration = UIAccessibility.isReduceMotionEnabled ? 0 : Self.launchFadeDuration
        let dismissal = DispatchWorkItem { [weak self, weak overlay] in
            guard let self, let overlay else { return }
            if fadeDuration == 0 {
                self.removeLaunchOverlay(overlay)
                return
            }
            UIView.animate(withDuration: fadeDuration, animations: {
                overlay.alpha = 0
            }, completion: { [weak self, weak overlay] _ in
                guard let overlay else { return }
                self?.removeLaunchOverlay(overlay)
            })
        }
        launchOverlayDismissal = dismissal
        DispatchQueue.main.asyncAfter(
            deadline: .now() + Self.launchLogoDuration - fadeDuration,
            execute: dismissal
        )
    }

    private func removeLaunchOverlay(_ overlay: UIView) {
        guard launchOverlay === overlay else { return }
        overlay.removeFromSuperview()
        launchOverlay = nil
        launchOverlayDismissal = nil
    }

    func sceneDidDisconnect(_ scene: UIScene) {
        launchOverlayDismissal?.cancel()
        launchOverlayDismissal = nil
        launchOverlay?.removeFromSuperview()
        launchOverlay = nil
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
