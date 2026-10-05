import PhotosUI
import SwiftUI
import UIKit
import AVFoundation

struct SustainabilityCamScreen: View {
    let initialImage: UIImage
    let initialCapture: PhotoCapture
    let backend: BackendSession
    let onRetake: () -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var result: BackendActivityResponse?
    @State private var errorMessage: String?
    @State private var isProcessing = false

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack {
                HStack {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.title3.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(width: 44, height: 44)
                            .background(Color.white.opacity(0.12), in: Circle())
                            .overlay(Circle().strokeBorder(Color.white.opacity(0.16)))
                    }
                    .accessibilityLabel("Back")
                    Spacer()
                }

                Spacer()

                if isProcessing {
                    ProgressView()
                        .tint(FanStyle.teal)
                    Text("Sending…")
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
                } else {
                    confirmationView
                }

                Spacer()
            }
            .padding(.horizontal, 24)
            .padding(.top, 16)
            .padding(.bottom, 12)
        }
    }

    private var confirmationView: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Image(systemName: "camera.fill")
                    .font(.headline)
                    .foregroundStyle(.black)
                    .frame(width: 34, height: 34)
                    .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 10))
                Text("Ready to send?")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }

            Button {
                Task { await verify() }
            } label: {
                Text("Use this photo")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(CameraPrimaryButtonStyle())

            Button("Retake photo", action: onRetake)
                .frame(maxWidth: .infinity)
                .buttonStyle(CameraSecondaryButtonStyle())
        }
        .padding(18)
        .background(FanStyle.panel, in: RoundedRectangle(cornerRadius: 20))
        .overlay(RoundedRectangle(cornerRadius: 20).strokeBorder(Color.white.opacity(0.12)))
    }

    @ViewBuilder
    private func resultView(_ result: BackendActivityResponse) -> some View {
        switch result.kind {
        case .accepted:
            VStack(spacing: 14) {
                Text("\(result.creditedPoints)")
                    .font(.system(size: 64, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
                Text("Sustainability Points")
                    .font(.headline)
                    .foregroundStyle(.white)
                if let score = result.evidenceScore {
                    Text("Score (score)/100")
                        .font(.title3.bold())
                        .foregroundStyle(FanStyle.teal)
                }
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
        case .uncertain, .rejected, .cancelled, .expired:
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
        guard !isProcessing else { return }
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

private struct CameraPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.black)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(FanStyle.teal, in: RoundedRectangle(cornerRadius: 3))
            .opacity(configuration.isPressed ? 0.75 : 1)
    }
}

private struct CameraSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
            .background(Color.clear, in: RoundedRectangle(cornerRadius: 3))
            .overlay(RoundedRectangle(cornerRadius: 3).strokeBorder(FanStyle.teal.opacity(0.72)))
            .opacity(configuration.isPressed ? 0.75 : 1)
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
    let onImagePicked: (UIImage, PhotoCapture) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> CameraViewController {
        CameraViewController(onImagePicked: onImagePicked, onCancel: onCancel)
    }

    func updateUIViewController(_: CameraViewController, context _: Context) { }
}

final class CameraViewController: UIViewController, AVCapturePhotoCaptureDelegate, PHPickerViewControllerDelegate {
    private let onImagePicked: (UIImage, PhotoCapture) -> Void
    private let onCancel: () -> Void
    private let session = AVCaptureSession()
    private let photoOutput = AVCapturePhotoOutput()
    private let sessionQueue = DispatchQueue(label: "com.amr.fanapp.camera")
    private let previewLayer = AVCaptureVideoPreviewLayer()
    private let statusLabel = UILabel()
    private var configured = false

    init(onImagePicked: @escaping (UIImage, PhotoCapture) -> Void, onCancel: @escaping () -> Void) {
        self.onImagePicked = onImagePicked
        self.onCancel = onCancel
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        previewLayer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(previewLayer)
        addControls()
        configureSession()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer.frame = view.bounds
    }

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        sessionQueue.async { [session] in
            if session.isRunning { session.stopRunning() }
        }
    }

    private func addControls() {
        let backButton = circularButton(symbol: "chevron.left", size: 44, background: UIColor.black.withAlphaComponent(0.58), tint: .white)
        backButton.accessibilityLabel = "Back"
        backButton.addTarget(self, action: #selector(cancel), for: .touchUpInside)

        let galleryButton = circularButton(symbol: "photo.on.rectangle", size: 52, background: UIColor.black.withAlphaComponent(0.58), tint: .white)
        galleryButton.accessibilityLabel = "Open gallery"
        galleryButton.addTarget(self, action: #selector(chooseLibrary), for: .touchUpInside)

        let shutterButton = circularButton(symbol: "camera.fill", size: 76, background: .white, tint: .black)
        shutterButton.accessibilityLabel = "Take photo"
        shutterButton.layer.borderWidth = 3
        shutterButton.layer.borderColor = UIColor.white.withAlphaComponent(0.72).cgColor
        shutterButton.addTarget(self, action: #selector(capturePhoto), for: .touchUpInside)

        [backButton, galleryButton, shutterButton].forEach { view.addSubview($0) }
        NSLayoutConstraint.activate([
            backButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 20),
            backButton.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 16),
            backButton.widthAnchor.constraint(equalToConstant: 44),
            backButton.heightAnchor.constraint(equalToConstant: 44),
            galleryButton.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            galleryButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            galleryButton.widthAnchor.constraint(equalToConstant: 52),
            galleryButton.heightAnchor.constraint(equalToConstant: 52),
            shutterButton.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            shutterButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -18),
            shutterButton.widthAnchor.constraint(equalToConstant: 76),
            shutterButton.heightAnchor.constraint(equalToConstant: 76)
        ])

        statusLabel.textColor = .white
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.isHidden = true
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)
        NSLayoutConstraint.activate([
            statusLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            statusLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28)
        ])
    }

    private func circularButton(symbol: String, size: CGFloat, background: UIColor, tint: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.setImage(UIImage(systemName: symbol), for: .normal)
        button.tintColor = tint
        button.backgroundColor = background
        button.layer.cornerRadius = size / 2
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }

    private func configureSession() {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            startSession()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                if granted { self?.startSession() } else { self?.showCameraUnavailable() }
            }
        default:
            showCameraUnavailable()
        }
    }

    private func startSession() {
        sessionQueue.async { [weak self] in
            guard let self, !configured,
                  let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
                  let input = try? AVCaptureDeviceInput(device: device),
                  session.canAddInput(input), session.canAddOutput(photoOutput) else {
                self?.showCameraUnavailable()
                return
            }
            session.beginConfiguration()
            session.sessionPreset = .photo
            session.addInput(input)
            session.addOutput(photoOutput)
            session.commitConfiguration()
            configured = true
            session.startRunning()
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                previewLayer.session = session
            }
        }
    }

    private func showCameraUnavailable() {
        DispatchQueue.main.async { [weak self] in
            self?.statusLabel.text = "Camera access is unavailable. Use the gallery button to choose a photo."
            self?.statusLabel.isHidden = false
        }
    }

    @objc private func cancel() { onCancel() }

    @objc private func capturePhoto() {
        guard configured else { return }
        photoOutput.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
    }

    @objc private func chooseLibrary() {
        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .images
        configuration.selectionLimit = 1
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        present(picker, animated: true)
    }

    func photoOutput(_: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        guard error == nil, let data = photo.fileDataRepresentation(), let image = UIImage(data: data) else { return }
        DispatchQueue.main.async { [onImagePicked] in onImagePicked(image, .camera) }
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard let result = results.first else {
            picker.dismiss(animated: true)
            return
        }
        result.itemProvider.loadObject(ofClass: UIImage.self) { [weak self] object, _ in
            guard let self, let image = object as? UIImage else { return }
            DispatchQueue.main.async {
                picker.dismiss(animated: true) { self.onImagePicked(image, .gallery) }
            }
        }
    }
}

#Preview {
    SustainabilityCamScreen(initialImage: UIImage(), initialCapture: .gallery, backend: BackendSession(), onRetake: {})
        .preferredColorScheme(.dark)
}
