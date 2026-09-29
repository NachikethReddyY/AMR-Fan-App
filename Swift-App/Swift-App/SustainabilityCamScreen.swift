import PhotosUI
import SwiftUI
import UIKit

struct SustainabilityCamScreen: View {
    let initialImage: UIImage
    let initialCapture: PhotoCapture
    let backend: BackendSession
    @Environment(\.dismiss) private var dismiss
    @State private var result: BackendActivityResponse?
    @State private var errorMessage: String?
    @State private var isProcessing = true
    @State private var hasStarted = false

    var body: some View {
        ZStack {
            FanStyle.background.ignoresSafeArea()
            VStack(spacing: 26) {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.title3.bold())
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                    }
                    Spacer()
                }

                Spacer()

                if isProcessing {
                    ProgressView()
                        .tint(.blue)
                        .padding(.horizontal, 36)
                    Text("Image processing…")
                        .font(.headline)
                        .foregroundStyle(.white)
                } else if let result {
                    resultView(result)
                } else if let errorMessage {
                    Label("Could not process photo", systemImage: "exclamationmark.triangle.fill")
                        .font(.title3.bold())
                        .foregroundStyle(.orange)
                    Text(errorMessage)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(FanStyle.muted)
                        .padding(.horizontal, 28)
                    Button("Try again") {
                        Task { await verify() }
                    }
                    .buttonStyle(ResultButtonStyle())
                }

                Spacer()
            }
            .padding(24)
        }
        .task {
            guard !hasStarted else { return }
            hasStarted = true
            await verify()
        }
    }

    @ViewBuilder
    private func resultView(_ result: BackendActivityResponse) -> some View {
        switch result.kind {
        case .verified:
            VStack(spacing: 14) {
                Text("\(result.creditedPoints)")
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("Sustainability Points")
                    .font(.headline)
                    .foregroundStyle(.white)
                if let confidence = result.confidence {
                    Text("Confidence \(confidence, format: .percent.precision(.fractionLength(0)))")
                        .foregroundStyle(.blue)
                }
                if let object = result.object {
                    Text(object.capitalized)
                        .foregroundStyle(FanStyle.muted)
                }
                if let message = result.message {
                    Text(message)
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(FanStyle.muted)
                        .padding(.horizontal, 24)
                }
                Button("Next") { dismiss() }
                    .buttonStyle(ResultButtonStyle())
                    .padding(.top, 18)
            }
        case .rejected:
            VStack(spacing: 14) {
                Text("0")
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("Sustainability Points")
                    .font(.headline)
                    .foregroundStyle(.white)
                Text(result.message ?? "The photo was not verified.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(FanStyle.muted)
                Button("Done") { dismiss() }
                    .buttonStyle(ResultButtonStyle())
                    .padding(.top, 18)
            }
        case .unavailable:
            VStack(spacing: 14) {
                Label("Analysis unavailable", systemImage: "wifi.exclamationmark")
                    .font(.title3.bold())
                    .foregroundStyle(.orange)
                Text(result.message ?? "Photo verification is unavailable.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(FanStyle.muted)
                Button("Done") { dismiss() }
                    .buttonStyle(ResultButtonStyle())
                    .padding(.top, 18)
            }
        }
    }

    private func verify() async {
        isProcessing = true
        errorMessage = nil
        do {
            result = try await backend.verify(image: initialImage, capture: initialCapture)
        } catch {
            errorMessage = error.localizedDescription
        }
        isProcessing = false
    }
}

private struct ResultButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 15)
            .background(Color.green.opacity(0.85), in: RoundedRectangle(cornerRadius: 12))
            .opacity(configuration.isPressed ? 0.75 : 1)
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
        context.coordinator.cameraController = picker

        let overlay = UIView(frame: picker.view.bounds)
        overlay.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        let photosButton = UIButton(type: .system)
        photosButton.setImage(UIImage(systemName: "photo.on.rectangle"), for: .normal)
        photosButton.tintColor = .white
        photosButton.accessibilityLabel = "Photos"
        photosButton.backgroundColor = UIColor.black.withAlphaComponent(0.65)
        photosButton.layer.cornerRadius = 24
        photosButton.addTarget(context.coordinator, action: #selector(Coordinator.chooseLibrary), for: .touchUpInside)
        photosButton.translatesAutoresizingMaskIntoConstraints = false
        overlay.addSubview(photosButton)
        NSLayoutConstraint.activate([
            photosButton.leadingAnchor.constraint(equalTo: overlay.leadingAnchor, constant: 24),
            photosButton.bottomAnchor.constraint(equalTo: overlay.bottomAnchor, constant: -128),
            photosButton.widthAnchor.constraint(equalToConstant: 48),
            photosButton.heightAnchor.constraint(equalToConstant: 48)
        ])
        picker.cameraOverlayView = overlay
        return picker
    }

    func updateUIViewController(_: UIImagePickerController, context _: Context) { }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate, PHPickerViewControllerDelegate {
        let onImagePicked: (UIImage) -> Void
        let dismiss: DismissAction
        weak var cameraController: UIImagePickerController?

        init(onImagePicked: @escaping (UIImage) -> Void, dismiss: DismissAction) {
            self.onImagePicked = onImagePicked
            self.dismiss = dismiss
        }

        @objc func chooseLibrary() {
            var configuration = PHPickerConfiguration(photoLibrary: .shared())
            configuration.filter = .images
            configuration.selectionLimit = 1
            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self
            cameraController?.present(picker, animated: true)
        }

        func imagePickerController(_: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            if let image = info[.originalImage] as? UIImage {
                onImagePicked(image)
            } else {
                dismiss()
            }
        }

        func imagePickerControllerDidCancel(_: UIImagePickerController) {
            dismiss()
        }

        func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
            guard let result = results.first else {
                picker.dismiss(animated: true)
                return
            }
            result.itemProvider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
                guard let self, let image = object as? UIImage else { return }
                DispatchQueue.main.async {
                    picker.dismiss(animated: true) {
                        self.onImagePicked(image)
                    }
                }
            }
        }
    }
}

#Preview {
    SustainabilityCamScreen(initialImage: UIImage(), initialCapture: .gallery, backend: BackendSession())
        .preferredColorScheme(.dark)
}
