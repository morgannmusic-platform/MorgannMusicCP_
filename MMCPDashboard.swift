import SwiftUI
import FirebaseCore

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        FirebaseApp.configure()
        return true
    }
}

final class AppSession: ObservableObject {
    @AppStorage("mmcp_isAuthenticated") private var storedAuth = false
    @AppStorage("mmcp_userEmail") private var storedEmail = ""

    @Published var isAuthenticated = false
    @Published var userEmail = ""

    init() {
        isAuthenticated = storedAuth
        userEmail = storedEmail
    }

    func signIn(email: String, password: String) throws {
        let cleanedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        guard cleanedEmail.contains("@"), cleanedEmail.contains(".") else {
            throw AuthError.invalidEmail
        }

        guard password.count >= 6 else {
            throw AuthError.invalidPassword
        }

        isAuthenticated = true
        userEmail = cleanedEmail
        storedAuth = true
        storedEmail = cleanedEmail
    }

    func signUp(email: String, password: String, confirmPassword: String) throws {
        guard password == confirmPassword else {
            throw AuthError.passwordMismatch
        }

        try signIn(email: email, password: password)
    }

    func signOut() {
        isAuthenticated = false
        userEmail = ""
        storedAuth = false
        storedEmail = ""
    }
}

enum AuthError: LocalizedError {
    case invalidEmail
    case invalidPassword
    case passwordMismatch

    var errorDescription: String? {
        switch self {
        case .invalidEmail:
            return "Adresse email invalide."
        case .invalidPassword:
            return "Le mot de passe doit contenir au moins 6 caractères."
        case .passwordMismatch:
            return "Les mots de passe ne correspondent pas."
        }
    }
}

enum AuthMode: String, CaseIterable {
    case login = "Connexion"
    case signup = "Inscription"
}

@main
struct MMCPDashboardApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var delegate
    @StateObject private var session = AppSession()

    var body: some Scene {
        WindowGroup {
            NavigationView {
                RootView()
                    .environmentObject(session)
            }
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        Group {
            if session.isAuthenticated {
                DashboardView()
            } else {
                AuthView()
            }
        }
    }
}

struct AuthView: View {
    @EnvironmentObject private var session: AppSession

    @State private var mode: AuthMode = .login
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var errorMessage = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
                Picker("Mode", selection: $mode) {
                    ForEach(AuthMode.allCases, id: \.self) { currentMode in
                        Text(currentMode.rawValue).tag(currentMode)
                    }
                }
                .pickerStyle(.segmented)

                VStack(spacing: 14) {
                    TextField("Email", text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .padding()
                        .background(.gray.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    SecureField("Mot de passe", text: $password)
                        .padding()
                        .background(.gray.opacity(0.12))
                        .clipShape(RoundedRectangle(cornerRadius: 12))

                    if mode == .signup {
                        SecureField("Confirmer le mot de passe", text: $confirmPassword)
                            .padding()
                            .background(.gray.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }

                if !errorMessage.isEmpty {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.footnote)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    submit()
                } label: {
                    HStack {
                        if isLoading {
                            ProgressView()
                        }
                        Text(mode == .login ? "Se connecter" : "Créer un compte")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading)

                Spacer()
            }
            .padding()
            .navigationTitle("MMCP")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func submit() {
        errorMessage = ""
        isLoading = true

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
            do {
                switch mode {
                case .login:
                    try session.signIn(email: email, password: password)
                case .signup:
                    try session.signUp(email: email, password: password, confirmPassword: confirmPassword)
                }
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? "Erreur inconnue."
            }
            isLoading = false
        }
    }
}

struct DashboardView: View {
    @EnvironmentObject private var session: AppSession

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    dashboardCard(
                        title: "Bienvenue",
                        value: session.userEmail,
                        icon: "person.crop.circle.fill"
                    )

                    dashboardCard(
                        title: "Sorties ce mois",
                        value: "3",
                        icon: "music.note.list"
                    )

                    dashboardCard(
                        title: "Écoutes estimées",
                        value: "128 450",
                        icon: "waveform"
                    )

                    dashboardCard(
                        title: "Notifications",
                        value: "5 nouvelles",
                        icon: "bell.badge.fill"
                    )
                }
                .padding()
            }
            .navigationTitle("Tableau de bord")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Déconnexion") {
                        session.signOut()
                    }
                }
            }
        }
    }

    private func dashboardCard(title: String, value: String, icon: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.title2)
                .frame(width: 42, height: 42)
                .background(.blue.opacity(0.16))
                .clipShape(RoundedRectangle(cornerRadius: 10))

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.headline)
                    .lineLimit(1)
            }
            Spacer()
        }
        .padding()
        .background(.thinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

#Preview {
    RootView()
        .environmentObject(AppSession())
}
