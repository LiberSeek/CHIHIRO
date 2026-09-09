// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "CapacitorOnebotConnctor",
    platforms: [.iOS(.v13)],
    products: [
        .library(
            name: "CapacitorOnebotConnctor",
            targets: ["OnebotPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", branch: "main")
    ],
    targets: [
        .target(
            name: "OnebotPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/OnebotPlugin"),
        .testTarget(
            name: "OnebotPluginTests",
            dependencies: ["OnebotPlugin"],
            path: "ios/Tests/OnebotPluginTests")
    ]
)