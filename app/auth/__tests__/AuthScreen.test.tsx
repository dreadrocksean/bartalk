import { fireEvent, render, waitFor } from "@testing-library/react-native";
import AuthScreen from "../index";

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(() => ({ type: "cancelled" })),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED",
  },
}));
jest.mock("expo-apple-authentication", () => ({
  signInAsync: jest.fn(() => ({
    user: "apple-user",
    identityToken: "token",
    fullName: { givenName: "Apple", familyName: "User" },
    email: "apple@user.com",
  })),
  AppleAuthenticationScope: { FULL_NAME: "FULL_NAME", EMAIL: "EMAIL" },
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: {},
  AppleAuthenticationButtonStyle: {},
}));
jest.mock("../../../hooks/use-push-notifications", () => ({
  usePushNotifications: () => ({ requestPushPermissionAndToken: jest.fn() }),
}));
jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({ user: { uid: "uid" } }),
  ),
  signInWithEmailAndPassword: jest.fn(() =>
    Promise.resolve({ user: { uid: "uid" } }),
  ),
  signInWithCredential: jest.fn(() =>
    Promise.resolve({ user: { uid: "uid" } }),
  ),
  GoogleAuthProvider: { credential: jest.fn() },
  OAuthProvider: jest.fn(() => ({ credential: jest.fn() })),
}));
jest.mock("../../../api", () => ({
  createUserProfile: jest.fn(() => Promise.resolve()),
}));

describe("AuthScreen", () => {
  it("renders sign in and sign up forms", () => {
    const { getByPlaceholderText, getByText } = render(
      <AuthScreen onAuthSuccess={jest.fn()} />,
    );
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
    expect(getByText("Don't have an account? Sign Up")).toBeTruthy();
  });

  it("toggles between sign in and sign up", () => {
    const { getByText, getByPlaceholderText } = render(
      <AuthScreen onAuthSuccess={jest.fn()} />,
    );
    fireEvent.press(getByText("Don't have an account? Sign Up"));
    expect(getByPlaceholderText("First Name")).toBeTruthy();
    expect(getByPlaceholderText("Last Name")).toBeTruthy();
    expect(getByPlaceholderText("Phone")).toBeTruthy();
  });

  it("calls handleAuth on sign in", async () => {
    const onAuthSuccess = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <AuthScreen onAuthSuccess={onAuthSuccess} />,
    );
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password");
    fireEvent.press(getByText("Sign In"));
    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
  });

  it("calls handleAuth on sign up", async () => {
    const onAuthSuccess = jest.fn();
    const { getByPlaceholderText, getByText } = render(
      <AuthScreen onAuthSuccess={onAuthSuccess} />,
    );
    fireEvent.press(getByText("Don't have an account? Sign Up"));
    fireEvent.changeText(getByPlaceholderText("First Name"), "Test");
    fireEvent.changeText(getByPlaceholderText("Last Name"), "User");
    fireEvent.changeText(getByPlaceholderText("Phone"), "1234567890");
    fireEvent.changeText(getByPlaceholderText("Email"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Password"), "password");
    fireEvent.press(getByText("Sign Up"));
    await waitFor(() => expect(onAuthSuccess).toHaveBeenCalled());
  });

  it("handles Google sign-in cancel", async () => {
    const { getByText } = render(<AuthScreen onAuthSuccess={jest.fn()} />);
    fireEvent.press(getByText("Sign in with Google"));
    await waitFor(() => getByText("Sign in with Google"));
  });

  it("handles Apple sign-in", async () => {
    const { getByText } = render(<AuthScreen onAuthSuccess={jest.fn()} />);
    fireEvent.press(getByText("Sign in with Apple"));
    await waitFor(() => getByText("Sign in with Apple"));
  });
});
