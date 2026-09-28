import PhotosUI
import SwiftUI
import UIKit

struct SustainabilityCamScreen: View {
    @Binding var demoState: DemoFanState
    @EnvironmentObject private var backend: BackendSession
    @State private var selectedAction: SustainabilityAction = .publicTransport
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var capturedImage: UIImage?
    @State private var showCamera = false
    @State private var showCameraUnavailable = false
    @State private var isLoadingPhoto = false
    @State private var verificationState: PhotoVerificationState = .ready
    @State private var lastCreditedPoints = 0
    @State private var detectedObject: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionHeader(
                    title: "Sustainability cam.",
                    description: "Capture the everyday choices that make a difference."
                )

                FeatureCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Label("CHOOSE AN ACTION", systemImage: "leaf.fill")
                            .font(.caption.bold())
                            .foregroundStyle(FanStyle.teal)

                        Text("What are you doing today?")
                            .font(.title3.bold())

                        ForEach(SustainabilityAction.allCases) { action in
                            Button {
                                selectedAction = action
                                verificationState = .ready
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: action.symbol)
                                        .frame(width: 24)
                                        .foregroundStyle(selectedAction == action ? FanStyle.teal : FanStyle.muted)
                                    Text(action.rawValue)
                                    Spacer()
                                    if selectedAction == action {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(FanStyle.teal)
                                    }
                                }
                                .foregroundStyle(.white)
                                .padding(14)
                                .background(
                                    selectedAction == action ? FanStyle.darkTeal : FanStyle.background,
                                    in: RoundedRectangle(cornerRadius: 14)
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 14)
                                        .strokeBorder(selectedAction == action ? FanStyle.teal : .white.opacity(0.08))
                                )
                            }
                            .buttonStyle(.plain)
                        }

                        Text("For public transport, use a photo taken inside a bus or train showing seats, doors, or railings. Recycling verification is a future feature.")
                            .font(.footnote)
                            .foregroundStyle(FanStyle.muted)
                    }
                }

                FeatureCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Label("ADD PROOF", systemImage: "camera.fill")
                            .font(.caption.bold())
                            .foregroundStyle(FanStyle.teal)

                        if let capturedImage {
                            Image(uiImage: capturedImage)
                                .resizable()
                                .scaledToFill()
                                .frame(maxWidth: .infinity)
                                .frame(height: 220)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .accessibilityLabel("Photo of your sustainability action")
                        } else {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 48))
                                .foregroundStyle(FanStyle.teal)
                                .frame(maxWidth: .infinity)
                                .frame(height: 180)
                                .background(FanStyle.background, in: RoundedRectangle(cornerRadius: 16))
                        }

                        Button {
                            selectedAction = .publicTransport
                            Task {
                                isLoadingPhoto = true
                                verificationState = .uploading
                                defer { isLoadingPhoto = false }
                                do {
                                    let result = try await backend.verifyFixture()
                                    lastCreditedPoints = result.creditedPoints
                                    detectedObject = result.object
                                    verificationState = result.kind == .verified ? .verified : .failed(result.message ?? "The fixture was not accepted.")
                                } catch {
                                    verificationState = .failed(error.localizedDescription)
                                }
                            }
                        } label: {
                            Label("Try backend sample", systemImage: "bolt.horizontal.circle")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(SustainabilityActionButtonStyle())

                        HStack(spacing: 10) {
                            Button {
                                guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                                    showCameraUnavailable = true
                                    return
                                }
                                showCamera = true
                            } label: {
                                Label("Take photo", systemImage: "camera.fill")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(SustainabilityActionButtonStyle())

                            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                                Label("Choose photo", systemImage: "photo.on.rectangle")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(SustainabilityActionButtonStyle())
                        }

                        Text("Photos are sent transiently to the connected backend. The sample is a clearly labelled local fixture; arbitrary photos receive no points until a reviewed vision provider is enabled.")
                            .font(.footnote)
                            .foregroundStyle(FanStyle.muted)
                    }
                }

                if isLoadingPhoto {
                    ProgressView("Checking photo…")
                        .tint(FanStyle.teal)
                } else if case .verified = verificationState {
                    FeatureCard {
                        Label("+\(lastCreditedPoints) Green Points added", systemImage: "checkmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(FanStyle.teal)
                        if let detectedObject {
                            Text("Detected: \(detectedObject)")
                                .font(.subheadline)
                                .foregroundStyle(FanStyle.muted)
                        }
                    }
                } else if case .rejected = verificationState {
                    FeatureCard {
                        Label("0 Green Points awarded", systemImage: "xmark.seal.fill")
                            .font(.headline)
                            .foregroundStyle(.orange)
                        Text("The selected sustainable action could not be confirmed.")
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                } else if case .failed(let message) = verificationState {
                    FeatureCard {
                        Label("Verification unavailable", systemImage: "wifi.exclamationmark")
                            .font(.headline)
                        Text(message)
                            .font(.subheadline)
                            .foregroundStyle(FanStyle.muted)
                    }
                }
            }
            .padding(22)
            .padding(.bottom, 30)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(FanStyle.background)
        .sheet(isPresented: $showCamera) {
            CameraPicker { image in
                Task { await verify(image) }
                showCamera = false
            }
            .ignoresSafeArea()
        }
        .alert("Camera unavailable", isPresented: $showCameraUnavailable) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Choose a photo from your library instead.")
        }
        .task(id: selectedPhotoItem) {
            await loadSelectedPhoto()
        }
    }

    private func loadSelectedPhoto() async {
        guard let selectedPhotoItem else { return }
        isLoadingPhoto = true
        defer { isLoadingPhoto = false }

        guard let data = try? await selectedPhotoItem.loadTransferable(type: Data.self),
              let image = UIImage(data: data) else { return }
        await verify(image)
    }

    private func verify(_ image: UIImage) async {
        capturedImage = image
        isLoadingPhoto = true
        defer { isLoadingPhoto = false }
        verificationState = .uploading

        do {
            let result = try await backend.verify(image: image, action: selectedAction)
            lastCreditedPoints = result.creditedPoints
            detectedObject = result.object
            switch result.kind {
            case .verified:
                verificationState = .verified
            case .rejected:
                verificationState = .rejected
            case .unavailable:
                verificationState = .failed(result.message ?? "Photo verification is unavailable.")
            }
        } catch {
            verificationState = .failed(error.localizedDescription)
        }
    }
}

private enum PhotoVerificationState {
    case ready
    case uploading
    case verified
    case rejected
    case failed(String)
}

private struct SustainabilityActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.bold())
            .foregroundStyle(.white)
            .padding(.vertical, 13)
            .background(FanStyle.darkTeal, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(FanStyle.teal.opacity(0.55)))
            .opacity(configuration.isPressed ? 0.78 : 1)
    }
}

private struct CameraPicker: UIViewControllerRepresentable {
    let onImagePicked: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator {
        Coordinator(onImagePicked: onImagePicked, dismiss: dismiss)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_: UIImagePickerController, context _: Context) { }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let onImagePicked: (UIImage) -> Void
        let dismiss: DismissAction

        init(onImagePicked: @escaping (UIImage) -> Void, dismiss: DismissAction) {
            self.onImagePicked = onImagePicked
            self.dismiss = dismiss
        }

        func imagePickerController(
            _: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                onImagePicked(image)
            } else {
                dismiss()
            }
        }

        func imagePickerControllerDidCancel(_: UIImagePickerController) {
            dismiss()
        }
    }
}

#Preview {
    SustainabilityCamScreen(demoState: .constant(DemoFanState()))
        .environmentObject(BackendSession())
        .preferredColorScheme(.dark)
}
