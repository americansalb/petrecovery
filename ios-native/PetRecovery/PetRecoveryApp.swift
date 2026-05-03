import SwiftUI

@main
struct PetRecoveryApp: App {
    @StateObject private var searchViewModel = SearchViewModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(searchViewModel)
                .tint(.accentColor)
        }
    }
}
