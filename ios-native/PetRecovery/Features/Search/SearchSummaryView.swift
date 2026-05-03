import SwiftUI

struct SearchSummaryView: View {
    @EnvironmentObject private var vm: SearchViewModel
    let session: SearchSession

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                header
                miniMap
                statsBreakdown
                doneButton
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarBackButtonHidden(true)
    }

    private var header: some View {
        VStack(spacing: 10) {
            Text("Great Search!").font(.title.weight(.bold))
            Text("+\(session.pointsAwarded) POINTS")
                .font(.system(size: 44, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.accentColor)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .background(.background, in: RoundedRectangle(cornerRadius: 20))
    }

    private var miniMap: some View {
        SearchMapView(
            path: session.path,
            lastSeen: session.lastSeen,
            searchRadiusMeters: session.searchRadiusMeters,
            userLocation: nil
        )
        .frame(height: 240)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var statsBreakdown: some View {
        let breakdown = PointsCalculator.breakdown(
            validatedDistanceMiles: session.validatedDistanceMiles,
            uniqueCells: session.uniqueCellsVisited,
            durationSeconds: session.durationSeconds,
            startedAt: session.startedAt
        )

        return VStack(spacing: 0) {
            row("Distance",
                detail: String(format: "%.2f mi", session.validatedDistanceMiles),
                points: "+\(breakdown.distancePoints) pts")
            divider
            row("New Areas",
                detail: "\(session.uniqueCellsVisited) cells",
                points: "+\(breakdown.gridPoints) pts")
            divider
            row("Time",
                detail: formattedDuration(session.durationSeconds),
                points: "+\(breakdown.timePoints) pts")
            if breakdown.multiplier > 1 {
                divider
                row("Multiplier",
                    detail: String(format: "%.2fx", breakdown.multiplier),
                    points: "bonus")
            }
            divider
            HStack {
                Text("Total").font(.headline)
                Spacer()
                Text("\(breakdown.total) pts").font(.headline).foregroundStyle(Color.accentColor)
            }
            .padding(16)
        }
        .background(.background, in: RoundedRectangle(cornerRadius: 16))
    }

    private var divider: some View {
        Rectangle().fill(.secondary.opacity(0.15)).frame(height: 1)
    }

    private func row(_ title: String, detail: String, points: String) -> some View {
        HStack {
            Text(title).font(.subheadline)
            Spacer()
            Text(detail).font(.subheadline).foregroundStyle(.secondary)
            Text(points).font(.subheadline.weight(.semibold)).foregroundStyle(Color.accentColor)
                .frame(width: 80, alignment: .trailing)
        }
        .padding(.horizontal, 16).padding(.vertical, 14)
    }

    private var doneButton: some View {
        Button {
            vm.dismissSummary()
        } label: {
            Text("Done")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .foregroundStyle(.white)
                .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
    }

    private func formattedDuration(_ interval: TimeInterval) -> String {
        let minutes = Int(interval / 60)
        return "\(minutes) min"
    }
}
