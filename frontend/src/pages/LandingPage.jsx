import "./landing.css";

const STEPS = [
  {
    n: "01",
    title: "Create your donor profile",
    text: "Tell us your blood group, city and availability. It takes less than two minutes.",
  },
  {
    n: "02",
    title: "Get the right request",
    text: "Verified hospitals post requests, and we alert you only when your group is needed nearby.",
  },
  {
    n: "03",
    title: "Show up. Make an impact.",
    text: "Accept a request, meet the hospital team and give blood that changes a life.",
  },
];

const HOSPITAL_STEPS = [
  {
    n: "01",
    title: "Register your hospital",
    text: "Create a hospital account with your licence details. An administrator verifies it before you can post.",
  },
  {
    n: "02",
    title: "Post a request",
    text: "Choose the blood group, units, urgency and deadline. Matching donors in your city are alerted straight away.",
  },
  {
    n: "03",
    title: "Confirm donations",
    text: "See who accepted, contact them, and mark each donation as complete to close the request.",
  },
];

// Matches the compatibility rules used by the backend matching engine
const COMPATIBILITY = [
  { group: "O+", donateTo: "O+, A+, B+, AB+", receiveFrom: "O+, O-" },
  { group: "O-", donateTo: "All groups", receiveFrom: "O-" },
  { group: "A+", donateTo: "A+, AB+", receiveFrom: "A+, A-, O+, O-" },
  { group: "A-", donateTo: "A+, A-, AB+, AB-", receiveFrom: "A-, O-" },
  { group: "B+", donateTo: "B+, AB+", receiveFrom: "B+, B-, O+, O-" },
  { group: "B-", donateTo: "B+, B-, AB+, AB-", receiveFrom: "B-, O-" },
  { group: "AB+", donateTo: "AB+", receiveFrom: "All groups" },
  { group: "AB-", donateTo: "AB+, AB-", receiveFrom: "AB-, A-, B-, O-" },
];

function DropIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5c3.6 4.3 6.5 7.9 6.5 11.4a6.5 6.5 0 0 1-13 0C5.5 10.4 8.4 6.8 12 2.5z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className="landing">
      {/* Navigation */}
      <header className="nav">
        <div className="container nav__inner">
          <a href="/" className="brand">
            <span className="brand__logo"><DropIcon /></span>
            <span className="brand__text">
              <strong>Blood Donor</strong>
              <small>Finder</small>
            </span>
          </a>
          <nav className="nav__links" aria-label="Main">
            <a href="#how-it-works">How it works</a>
            <a href="#compatibility">Blood compatibility</a>
            <a href="#hospitals">For hospitals</a>
          </nav>
          <div className="nav__actions">
            <a href="/login" className="nav__login">Log in</a>
            <a href="/register" className="btn btn--primary btn--sm">Become a donor</a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="hero">
          <div className="container hero__grid">
            <div className="hero__copy">
              <span className="pill">A small act. A lifelong impact.</span>
              <h1>Every Drop Counts. Every Donor Matters.</h1>
              <p className="hero__lead">
                Connect with verified hospitals near you. Give blood when it matters
                most, and be someone's reason to hope.
              </p>
              <div className="hero__buttons">
                <a href="/register" className="btn btn--primary">Register as Donor</a>
                <a href="/login" className="btn btn--outline">Donor Login</a>
              </div>
              <ul className="hero__checks">
                <li><CheckIcon /> Free to join</li>
                <li><CheckIcon /> Verified hospitals</li>
              </ul>
              <p className="hero__note">
                A life at your door. Never in doubt about where to give.
              </p>
            </div>

            <div className="hero__visual" aria-label="Example blood request">
              <div className="request-card">
                <div className="request-card__top">
                  <div className="request-card__hospital">
                    <span className="request-card__icon"><DropIcon size={14} /></span>
                    <div>
                      <strong>City Care Hospital</strong>
                      <small>Kakkanad, Kochi</small>
                    </div>
                  </div>
                  <span className="badge badge--urgent">Urgent</span>
                </div>
                <div className="request-card__body">
                  <span className="request-card__group">O+</span>
                  <div>
                    <strong>2 units needed</strong>
                    <small>Required by today, 6:00 PM</small>
                  </div>
                </div>
              </div>
              <div className="match-card">
                <span className="match-card__icon"><CheckIcon /></span>
                <div>
                  <strong>15 eligible donors matched</strong>
                  <small>Same city. Available. Eligible to donate.</small>
                </div>
              </div>
              <p className="hero__visual-note">
                <CheckIcon /> Example request. Donor gap, city and blood group are matched automatically.
              </p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="section section--tint" id="how-it-works">
          <div className="container">
            <p className="eyebrow">A simple way to make a difference</p>
            <h2>Your next donation starts here.</h2>
            <div className="steps">
              {STEPS.map((step) => (
                <article className="step" key={step.n}>
                  <span className="step__num">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Blood compatibility */}
        <section className="section" id="compatibility">
          <div className="container compat">
            <div className="compat__intro">
              <p className="eyebrow">Know your blood group</p>
              <h2>Different groups. One shared purpose.</h2>
              <p>
                Every blood type can help someone. Check who you can give to and
                receive from, then see how your group fits in.
              </p>
              <div className="universal">
                <span className="universal__group">O-</span>
                <div>
                  <strong>Universal red cell donor</strong>
                  <small>O-negative blood can be given to patients of any blood group in an emergency.</small>
                </div>
              </div>
            </div>

            <div className="compat__table-wrap">
              <table className="compat__table">
                <thead>
                  <tr>
                    <th scope="col">Group</th>
                    <th scope="col">Can donate to</th>
                    <th scope="col">Can receive from</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPATIBILITY.map((row) => (
                    <tr key={row.group}>
                      <th scope="row"><span className="group-chip">{row.group}</span></th>
                      <td>{row.donateTo}</td>
                      <td>{row.receiveFrom}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="compat__note">
                Compatibility and eligibility are confirmed by the hospital before every donation.
              </p>
            </div>
          </div>
        </section>

        {/* For hospitals */}
        <section className="section section--tint" id="hospitals">
          <div className="container">
            <p className="eyebrow">For hospitals</p>
            <h2>Reach the right donors, fast.</h2>
            <div className="steps">
              {HOSPITAL_STEPS.map((step) => (
                <article className="step" key={step.n}>
                  <span className="step__num">{step.n}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              ))}
            </div>
            <div className="hero__buttons">
              <a href="/register" className="btn btn--primary">Register your hospital</a>
              <a href="/login" className="btn btn--outline">Hospital login</a>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="cta">
          <div className="container cta__inner">
            <div>
              <h2>Someone's tomorrow could start with you.</h2>
              <p>Join a community that turns compassion into action.</p>
            </div>
            <a href="/register" className="btn btn--light">Become a donor</a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer__grid">
          <div>
            <a href="/" className="brand brand--footer">
              <span className="brand__logo"><DropIcon /></span>
              <span className="brand__text"><strong>Blood Donor Finder</strong></span>
            </a>
            <p className="footer__tag">Connecting people. Supporting lives.</p>
          </div>
          <div className="footer__contact">
            <p><a href="/privacy">Privacy policy</a> <a href="/terms">Terms of use</a></p>
          </div>
        </div>
        <div className="container footer__legal">
          <p>
            Blood Donor Finder connects donors and hospitals. It does not replace
            medical screening.
          </p>
          <p>&copy; 2026 Blood Donor Finder</p>
        </div>
      </footer>
    </div>
  );
}