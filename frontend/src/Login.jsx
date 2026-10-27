
import { useState } from "react";

const API_URL = `${(import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "")}/auth`;

function Login({ onSwitchToSignup, onLogin }) {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Login failed.");
      }

      if (!result.token || !result.user) {
        throw new Error("The server did not return a login token.");
      }

      // Keep the same storage keys used by App.jsx.
      localStorage.setItem("staffsync_token", result.token);
      localStorage.setItem(
        "staffsync_user",
        JSON.stringify(result.user)
      );

      // Notify App.jsx that login succeeded.
      if (onLogin) {
        onLogin(result);
      }
    } catch (error) {
      setMessage(
        error.message || "Cannot connect to the StaffSync server."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Welcome Back</h1>
        <p style={styles.subtitle}>Log in to StaffSync</p>

        <label style={styles.label} htmlFor="loginEmail">
          Email Address
        </label>

        <input
          id="loginEmail"
          style={styles.input}
          type="email"
          name="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Enter your email"
          autoComplete="email"
          required
        />

        <label style={styles.label} htmlFor="loginPassword">
          Password
        </label>

        <input
          id="loginPassword"
          style={styles.input}
          type="password"
          name="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <button
          type="submit"
          style={{
            ...styles.button,
            opacity: loading ? 0.7 : 1,
          }}
          disabled={loading}
        >
          {loading ? "Logging in..." : "Log In"}
        </button>

        {message && (
          <p role="alert" style={styles.message}>
            {message}
          </p>
        )}

        <p style={styles.footer}>
          Don't have an account?{" "}
          <button
            type="button"
            style={styles.link}
            onClick={onSwitchToSignup}
          >
            Sign Up
          </button>
        </p>
      </form>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f3f5f9",
    padding: 20,
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 400,
    background: "#fff",
    padding: 32,
    borderRadius: 14,
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
    boxSizing: "border-box",
  },
  title: {
    margin: "0 0 8px",
    color: "#202b46",
  },
  subtitle: {
    marginBottom: 24,
    color: "#6b7280",
  },
  label: {
    display: "block",
    margin: "14px 0 6px",
    fontSize: 14,
  },
  input: {
    width: "100%",
    padding: 12,
    border: "1px solid #d1d5db",
    borderRadius: 7,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: 12,
    marginTop: 22,
    border: 0,
    borderRadius: 7,
    background: "#3457d5",
    color: "white",
    cursor: "pointer",
  },
  message: {
    fontSize: 14,
    overflowWrap: "anywhere",
    color: "#b42318",
  },
  footer: {
    marginTop: 20,
    fontSize: 14,
    textAlign: "center",
  },
  link: {
    border: 0,
    background: "none",
    color: "#3457d5",
    cursor: "pointer",
  },
};

export default Login;
