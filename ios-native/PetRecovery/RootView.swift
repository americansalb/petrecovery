import SwiftUI

struct RootView: View {
    @EnvironmentObject private var searchVM: SearchViewModel

    var body: some View {
        NavigationStack {
            HomeView()
                .navigationDestination(isPresented: $searchVM.isSearchActive) {
                    ActiveSearchView()
                        .navigationBarBackButtonHidden(true)
                }
                .navigationDestination(item: $searchVM.completedSession) { session in
                    SearchSummaryView(session: session)
                        .navigationBarBackButtonHidden(true)
                }
        }
    }
}

#Preview {
    RootView()
        .environmentObject(SearchViewModel())
}
