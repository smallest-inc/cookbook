import SwiftUI

/// Smallest AI brand palette. Do not invent colors; pick from this file.
enum BrandColors {
    static let ink             = Color(red: 0x09/255, green: 0x20/255, blue: 0x23/255)
    static let inkSoft         = Color(red: 0x1D/255, green: 0x4E/255, blue: 0x52/255)
    static let teal            = Color(red: 0x43/255, green: 0xB6/255, blue: 0xB6/255)
    static let tealSoft        = Color(red: 0x43/255, green: 0xB6/255, blue: 0xB6/255).opacity(0.13)
    static let surface         = Color(red: 0xFB/255, green: 0xFA/255, blue: 0xF5/255)
    static let surfaceAlt      = Color(red: 0xF8/255, green: 0xF7/255, blue: 0xF2/255)
    static let surfaceHighlight = Color(red: 0xFC/255, green: 0xFB/255, blue: 0xFA/255)
    static let divider         = Color(red: 0xEF/255, green: 0xED/255, blue: 0xE9/255)
    static let gold            = Color(red: 0xFF/255, green: 0xCF/255, blue: 0x72/255)
    static let coral           = Color(red: 0xFF/255, green: 0x5E/255, blue: 0x5E/255)
    static let blue            = Color(red: 0x3E/255, green: 0x91/255, blue: 0xD5/255)
    static let textPrimary     = Color(red: 0x09/255, green: 0x20/255, blue: 0x23/255)
    static let textSecondary   = Color(red: 0x1D/255, green: 0x4E/255, blue: 0x52/255)
    static let textMuted       = Color(red: 0x09/255, green: 0x20/255, blue: 0x23/255).opacity(0.67)
    static let textOnDark      = Color(red: 0xFC/255, green: 0xFB/255, blue: 0xFA/255)
}
