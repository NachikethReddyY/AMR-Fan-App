import PhotosUI
import SwiftUI
import UIKit

struct SustainabilityCamScreen: View {
    var initialImage: UIImage? = nil
    var openGalleryOnAppear = false
    @EnvironmentObject private var backend: BackendSession
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var selectedImage: UIImage?
    @State private var pendingCameraImage: UIImage?
    @State private var showCamera = false
    @State private var showCameraUnavailable = false
    @State private var isProcessing = false
    @State private var verificationState: PhotoVerificationState = .ready
    @State private var didAutoOpenCamera = false
    @State private var showPhotoPicker = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                SectionHeader(
                    title: "Camera",
                    description: "Take a photo or choose one from Photos."
                )

                FeatureCard {
                    VStack(alignment: .leading, spacing: 16) {
                        Label("ADD PROOF", systemImage: "camera.fill")
                            .font(.caption.bold())
                            .foregroundStyle(FanStyle.teal)
                        if let selectedImage {
                            Image(uiImage: selectedImage)
                                .resizable()
                                .scaledToFill()
                                .frame(maxWidth: .infinity)
                                .frame(height: 220)
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .accessibilityLabel("Selected proof photo")
                        } else {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 48))
                                .foregroundStyle(FanStyle.teal)
                                .frame(maxWidth: .infinity)
                                .frame(height: 180)
                                .background(FanStyle.background, in: RoundedRectangle(cornerRadius: 16))
                        }
                        HStack(spacing: 10) {
                            Button {
                                openCamera()
                            } label: {
                                Label("Take photo", systemImage: "camera.fill")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(SustainabilityActionButtonStyle())

                            PhotosPicker(selection: $selectedPhotoItem, matching: .images, preferredItemEncoding: .automatic) {
                                Label("Choose photo", systemImage: "photo.on.rectangle")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(SustainabilityActionButtonStyle())
                        }
                        .disabled(isProcessing)
                        Text("When analysis is available, your selected photo is sent to the backend for review. The app does not save it.")
                            .font(.footnote)
                            .foregroundStyle(FanStyle.muted)
                    }
                }

                if isProcessing {
                    FeatureCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Label("ANALYSING PHOTO", systemImage: "sparkles")
                                .font(.caption.bold())
                                .foregroundStyle(FanStyle.teal)
                            ProgressView().tint(FanStyle.teal)
                            Text("Checking your proof with the sustainability service…")
                                .foregroundStyle(FanStyle.muted)
                        }
                    }
                } else {
                    resultCard
                }
            }
            .padding(22)
            .padding(.bottom, 30)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
        .background(FanStyle.background)
        .sheet(isPresented: $showCamera, onDismiss: {
            if let image = pendingCameraImage {
                pendingCameraImage = nil
                Task { await verify(image, capture: .camera) }
            }
        }) {
            CameraPicker { image in
                pendingCameraImage = image
                showCamera = false
            }
            .ignoresSafeArea()
        }
        .alert("Camera unavailable", isPresented: $showCameraUnavailable) {
            Button("OK", role: .cancel) { }
        } message: {
            Text("Choose a photo from your library instead.")
        }
        .photosPicker(isPresented: $showPhotoPicker, selection: $selectedPhotoItem, matching: .images, preferredItemEncoding: .automatic)
        .task(id: selectedPhotoItem) { await loadSelectedPhoto() }
        .onAppear {
            guard !didAutoOpenCamera else { return }
            didAutoOpenCamera = true
            if let initialImage {
                selectedImage = initialImage
                Task { await verify(initialImage, capture: .camera) }
            } else if openGalleryOnAppear {
                showPhotoPicker = true
            }
        }
    }

    private func openCamera() {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            showCameraUnavailable = true
            return
        }
        showCamera = true
    }

    @ViewBuilder private var resultCard: some View {
        switch verificationState {
        case .ready:
            EmptyView()
        case .verified(let result):
            FeatureCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("VERIFIED", systemImage: "checkmark.seal.fill")
                        .font(.caption.bold())
                        .foregroundStyle(FanStyle.teal)
                    Text("+\(result.creditedPoints) Green Points")
                        .font(.title2.bold())
                    if let object = result.object { Text(object.capitalized).foregroundStyle(FanStyle.muted) }
                    if let confidence = result.confidence {
                        Text("Confidence \(confidence, format: .percent.precision(.fractionLength(0)))")
                            .foregroundStyle(FanStyle.muted)
                    }
                    if let message = result.message {
                        Text(message).font(.footnote).foregroundStyle(FanStyle.muted)
                    }
                }
            }
        case .rejected(let result):
            FeatureCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("NOT VERIFIED", systemImage: "xmark.seal.fill")
                        .font(.caption.bold())
                        .foregroundStyle(.orange)
                    Text("No Green Points awarded").font(.title3.bold())
                    Text(result.message ?? "The photo did not provide enough evidence for this action.")
                        .foregroundStyle(FanStyle.muted)
                }
            }
        case .failed(let message):
            FeatureCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("VERIFICATION UNAVAILABLE", systemImage: "wifi.exclamationmark")
                        .font(.caption.bold())
                    Text(message).foregroundStyle(FanStyle.muted)
                }
            }
        }
    }

    private func loadSelectedPhoto() async {
        guard let selectedPhotoItem else { return }
        isProcessing = true
        verificationState = .ready
        selectedImage = nil
        defer { isProcessing = false }
        do {
            guard let data = try await selectedPhotoItem.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else {
                verificationState = .failed("The selected photo could not be read. Choose another image.")
                return
            }
            guard !Task.isCancelled else { return }
            await verify(image, capture: .gallery)
        } catch {
            verificationState = .failed(error.localizedDescription)
        }
    }

    private func verify(_ image: UIImage, capture: PhotoCapture) async {
        selectedImage = image
        isProcessing = true
        verificationState = .ready
        defer { isProcessing = false }
        do {
            let result = try await backend.verify(image: image, capture: capture)
            switch result.kind {
            case .verified: verificationState = .verified(result)
            case .rejected: verificationState = .rejected(result)
            case .unavailable: verificationState = .failed(result.message ?? "Photo verification is unavailable.")
            }
        } catch {
            verificationState = .failed(error.localizedDescription)
        }
    }
}

private enum PhotoVerificationState {
    case ready
    case verified(BackendActivityResponse)
    case rejected(BackendActivityResponse)
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

struct CameraPicker: UIViewControllerRepresentable {
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
    SustainabilityCamScreen()
        .environmentObject(BackendSession())
        .preferredColorScheme(.dark)
}
