import { Link } from "react-router-dom";

export default function SessionDenied() {
  return (
    <main className="user-page__content">
      <section className="user-page__empty" role="alert">
        <h1>Account session unavailable</h1>
        <p>We couldn't verify your account information. Sign out and sign in again, or try later.</p>
        <Link to="/login" className="btn btn--primary">Go to sign in</Link>
      </section>
    </main>
  );
}
