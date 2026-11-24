import { useNavigate } from "react-router-dom";
import "./info.css";

function InfoPage({ eyebrow, title, intro, sections, note }) {
  const navigate = useNavigate();
  return (
    <div className="info">
      <header className="info__bar">
        <a href="/" className="info__brand">Blood Donor Finder</a>
        <button type="button" className="info__back" onClick={() => navigate(-1)}>
          &larr; Back
        </button>
      </header>
      <main className="info__body">
        <p className="info__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="info__intro">{intro}</p>
        {note && <p className="info__note">{note}</p>}
        {sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.text && <p>{s.text}</p>}
            {s.items && <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>}
          </section>
        ))}
      </main>
    </div>
  );
}

export function GuidelinesPage() {
  return (
    <InfoPage
      eyebrow="Donor guide"
      title="Donation guidelines"
      intro="A few simple steps make donating safer and easier. The hospital's medical team always makes the final eligibility decision."
      sections={[
        {
          heading: "Who can donate",
          items: [
            "You are between 18 and 65 years old.",
            "You are in good health on the day of donation.",
            "At least 90 days have passed since your last whole-blood donation.",
            "You have marked yourself as Available in your profile.",
          ],
        },
        {
          heading: "Before you donate",
          items: [
            "Eat a healthy meal and drink plenty of water.",
            "Get a good night's sleep.",
            "Bring a photo ID.",
            "Tell the staff about any medicines or recent illness.",
          ],
        },
        {
          heading: "After you donate",
          items: [
            "Rest for a few minutes and have a snack and a drink.",
            "Drink extra fluids for the rest of the day.",
            "Avoid heavy exercise and heavy lifting for 24 hours.",
            "If you feel dizzy, sit or lie down and tell the staff.",
          ],
        },
        {
          heading: "How it works here",
          text: "When a verified hospital posts a request that matches your blood group and city, you get a notification. Your phone number is shared with the hospital only after you accept. After you donate, the hospital confirms it and your history is updated.",
        },
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Privacy policy"
      intro="We collect only what we need to match donors with hospitals."
      note="Draft: have this reviewed before you launch publicly."
      sections={[
        {
          heading: "What we collect",
          items: [
            "Account details: name, email and password (stored hashed).",
            "Donor details: date of birth, gender, blood group, city, phone number and last donation date.",
            "Hospital details: name, city, address, phone and licence number.",
            "Activity: requests posted, responses and confirmed donations.",
          ],
        },
        {
          heading: "Who can see your information",
          text: "Hospitals never see donor contact details publicly. A hospital can see a donor's name, blood group and phone number only after that donor accepts that hospital's request.",
        },
        {
          heading: "How we use it",
          text: "To match donors with requests, check donation eligibility and show your donation history. We do not sell your data.",
        },
        {
          heading: "Your choices",
          text: "You can update your details or switch to Unavailable at any time in My profile. To delete your account, contact us.",
        },
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <InfoPage
      eyebrow="Legal"
      title="Terms of use"
      intro="By using Blood Donor Finder you agree to these terms."
      note="Draft: have this reviewed before you launch publicly."
      sections={[
        {
          heading: "What the service is",
          text: "Blood Donor Finder connects donors with hospitals that need blood. We are not a medical provider and do not give medical advice.",
        },
        {
          heading: "Your responsibilities",
          items: [
            "Give accurate information, especially your blood group and last donation date.",
            "Hospitals must only post genuine requests.",
            "Do not misuse contact details you receive.",
          ],
        },
        {
          heading: "Medical decisions",
          text: "A hospital's medical staff decide whether a person can donate. Accepting a request does not guarantee that you will be allowed to donate.",
        },
        {
          heading: "Accounts",
          text: "Hospital accounts must be approved by an administrator. We may suspend accounts that break these terms.",
        },
      ]}
    />
  );
}