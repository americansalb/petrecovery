import Foundation

/// Implements the points formula from `docs/GPS_Search_Feature_Spec.md` §6.
enum PointsCalculator {
    struct Breakdown {
        let distancePoints: Int
        let gridPoints: Int
        let timePoints: Int
        let multiplier: Double
        let total: Int
    }

    static func breakdown(
        validatedDistanceMiles: Double,
        uniqueCells: Int,
        durationSeconds: TimeInterval,
        startedAt: Date,
        hoursAfterLost: Double? = nil,
        isFirstSearchToday: Bool = false
    ) -> Breakdown {
        let distancePoints = Int((validatedDistanceMiles * 100).rounded())
        let gridPoints = uniqueCells * 5
        let durationMinutes = durationSeconds / 60
        let timePoints = min(Int(durationMinutes / 15) * 10, 40)

        var multiplier = 1.0
        if let hours = hoursAfterLost, hours < 24 { multiplier *= 1.5 }
        if isOptimalTime(startedAt) { multiplier *= 1.25 }
        if isFirstSearchToday { multiplier *= 1.1 }

        let subtotal = Double(distancePoints + gridPoints + timePoints)
        let total = Int((subtotal * multiplier).rounded())

        return Breakdown(
            distancePoints: distancePoints,
            gridPoints: gridPoints,
            timePoints: timePoints,
            multiplier: multiplier,
            total: total
        )
    }

    private static func isOptimalTime(_ date: Date) -> Bool {
        let hour = Calendar.current.component(.hour, from: date)
        return (6...7).contains(hour) || (17...18).contains(hour)
    }
}
