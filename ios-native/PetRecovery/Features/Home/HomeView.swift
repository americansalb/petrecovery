import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var vm: SearchViewModel

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                missionCard
                primaryCTA
                permissionHint
                secondaryActions
                Spacer(minLength: 40)
            }
            .padding(20)
        }
        .navigationTitle("PetRecovery")
        .background(Color(.systemGroupedBackground))
    }

    private var missionCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Active Mission")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text("Max — Missing 2 days")
                .font(.title3.weight(.bold))
            Text("Last seen: Oak Street Park")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.background, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 2)
    }

    private var primaryCTA: some View {
        Button {
            vm.startSearch()
        } label: {
            VStack(spacing: 6) {
                Label("START SEARCHING", systemImage: "magnifyingglass")
                    .font(.headline)
                Text("Help find Max in your area · Earn 100 pts/mile")
                    .font(.footnote)
                    .opacity(0.9)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 18)
            .foregroundStyle(.white)
            .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 16))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var permissionHint: some View {
        switch vm.permissionState {
        case .notDetermined:
            hintCard(
                icon: "location.circle",
                title: "Location access required",
                message: "Tap Start Searching to grant location access. Your location is only used while you're searching.",
                actionTitle: "Enable Location",
                action: vm.requestWhenInUse
            )
        case .denied:
            hintCard(
                icon: "exclamationmark.triangle.fill",
                title: "Location is disabled",
                message: "Open Settings to allow PetRecovery to access your location while searching.",
                actionTitle: "Open Settings",
                action: openAppSettings
            )
        case .whenInUse:
            hintCard(
                icon: "moon.zzz",
                title: "Enable background tracking",
                message: "Searches often run with the screen off. Allowing 'Always' lets us count your full distance.",
                actionTitle: "Allow Always",
                action: vm.requestAlways
            )
        case .always:
            EmptyView()
        }
    }

    private var secondaryActions: some View {
        HStack(spacing: 12) {
            secondaryButton(icon: "eye", title: "Report Sighting") {}
            secondaryButton(icon: "square.and.arrow.up", title: "Share Mission") {}
        }
    }

    private func secondaryButton(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                Image(systemName: icon).font(.title3)
                Text(title).font(.footnote.weight(.semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(.background, in: RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }

    private func hintCard(
        icon: String,
        title: String,
        message: String,
        actionTitle: String,
        action: @escaping () -> Void
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Label(title, systemImage: icon).font(.subheadline.weight(.semibold))
            Text(message).font(.footnote).foregroundStyle(.secondary)
            Button(actionTitle, action: action)
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.yellow.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
    }

    private func openAppSettings() {
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
        }
    }
}

#Preview {
    NavigationStack { HomeView() }
        .environmentObject(SearchViewModel())
}
