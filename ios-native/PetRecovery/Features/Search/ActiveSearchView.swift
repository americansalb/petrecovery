import SwiftUI

struct ActiveSearchView: View {
    @EnvironmentObject private var vm: SearchViewModel
    @State private var showEndConfirmation = false

    var body: some View {
        ZStack(alignment: .bottom) {
            SearchMapView(
                path: vm.pathPings,
                lastSeen: vm.lastSeen,
                searchRadiusMeters: vm.searchRadiusMeters,
                userLocation: vm.locationManager.lastLocation?.coordinate
            )
            .ignoresSafeArea()

            VStack(spacing: 12) {
                if let warning = vm.lastValidationWarning {
                    warningBanner(warning)
                }
                statsPanel
                actionButtons
            }
            .padding(16)
        }
        .overlay(alignment: .top) { topBar }
        .confirmationDialog(
            "End your search?",
            isPresented: $showEndConfirmation,
            titleVisibility: .visible
        ) {
            Button("End & Earn \(vm.estimatedPoints) Points", role: .destructive) {
                vm.endSearch()
            }
            Button("Keep Searching", role: .cancel) {}
        } message: {
            Text(summaryDialogMessage)
        }
    }

    private var topBar: some View {
        HStack {
            Button {
                showEndConfirmation = true
            } label: {
                Label("Exit Search", systemImage: "chevron.left")
                    .labelStyle(.titleAndIcon)
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
            }
            .buttonStyle(.plain)

            Spacer()

            HStack(spacing: 6) {
                Circle().fill(.red).frame(width: 8, height: 8)
                Text("LIVE").font(.caption.weight(.bold))
            }
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(.ultraThinMaterial, in: Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    private var statsPanel: some View {
        HStack(spacing: 0) {
            stat(label: "Time", value: formattedTime(vm.elapsed), icon: "clock")
            divider
            stat(label: "Distance", value: String(format: "%.2f mi", vm.validatedDistanceMiles), icon: "figure.walk")
            divider
            stat(label: "Points", value: "\(vm.estimatedPoints)", icon: "star.fill")
        }
        .padding(.vertical, 14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
    }

    private var divider: some View {
        Rectangle().fill(.secondary.opacity(0.2)).frame(width: 1, height: 36)
    }

    private func stat(label: String, value: String, icon: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.title3.weight(.bold)).monospacedDigit()
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private var actionButtons: some View {
        VStack(spacing: 8) {
            Button {
                // TODO: Report sighting flow.
            } label: {
                Label("REPORT SIGHTING", systemImage: "eye")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(.background, in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)

            Button(role: .destructive) {
                showEndConfirmation = true
            } label: {
                Label("END SEARCH", systemImage: "stop.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .foregroundStyle(.white)
                    .background(Color.red, in: RoundedRectangle(cornerRadius: 14))
            }
            .buttonStyle(.plain)
        }
    }

    private func warningBanner(_ warning: SearchViewModel.ValidationWarning) -> some View {
        let (icon, text): (String, String) = {
            switch warning {
            case .outsideZone: return ("exclamationmark.triangle.fill", "You're outside the search area — distance won't count.")
            case .tooFast: return ("car.fill", "Movement paused — looks like you're in a vehicle.")
            }
        }()
        return Label(text, systemImage: icon)
            .font(.footnote.weight(.medium))
            .padding(.horizontal, 14).padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.orange.opacity(0.95), in: RoundedRectangle(cornerRadius: 12))
            .foregroundStyle(.white)
    }

    private var summaryDialogMessage: String {
        let miles = String(format: "%.2f", vm.validatedDistanceMiles)
        return "\(miles) mi · \(vm.uniqueCellsCount) cells · \(formattedTime(vm.elapsed))"
    }

    private func formattedTime(_ interval: TimeInterval) -> String {
        let total = Int(interval)
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        if h > 0 { return String(format: "%d:%02d:%02d", h, m, s) }
        return String(format: "%d:%02d", m, s)
    }
}

#Preview {
    ActiveSearchView()
        .environmentObject(SearchViewModel())
}
