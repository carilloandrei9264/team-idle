import { Link, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import "./LegalPage.css";

const UPDATED = "September 30, 2026";

const DOCUMENTS = {
  privacy: {
    title: "Privacy Policy",
    eyebrow: "Legal & data",
    intro: "This notice explains what TrustHome collects, how the current application uses it, and where information may be visible.",
    warning: "Test-build warning: Do not upload real government IDs or ownership documents. Verified listing records are publicly readable, and the current build can include verification-document URLs in those records. Document access has not been independently secured or audited.",
    sections: [
      {
        title: "Information we handle",
        paragraphs: [
          "Account information can include your name, email address, authentication identifier, role, and account status. Listing information can include property details, city, price, availability, photos, showing windows, an exact address, and ownership or identity document URLs.",
          "Booking information can include renter and owner identifiers, dates, status, an optional deposit reference, and the exact address after an owner confirms a booking. Reviews, dispute reasons and outcomes, public accountability counts, and in-app notifications are also stored.",
          "Theme and accessibility preferences are saved in local browser storage. The app does not operate a payment processor or hold deposits. Do not enter card numbers, passwords, PINs, or bank login credentials in a deposit-reference field.",
        ],
      },
      {
        title: "How information is used",
        paragraphs: [
          "Information supports account access, listing review, search, booking coordination, notifications, reviews, dispute handling, public accountability features, and trust-score calculations. It is not used to promise legal title verification or financial protection.",
        ],
      },
      {
        title: "What other users can see",
        paragraphs: [
          "Verified listing details, photos, approximate map locations, public profile details, reviews, trust information, and founded-dispute indicators may be visible to the public. Public listing maps use an approximate location; exact addresses are intended to be shared with the renter only after confirmation.",
          "The current test build has a known limitation: a public read of a verified listing can return verification-document URL fields. Until those fields are moved to a restricted store and tested, treat uploaded documents as potentially public and do not submit real IDs or ownership papers.",
        ],
      },
      {
        title: "Service providers and sharing",
        paragraphs: [
          "TrustHome uses Firebase Authentication and Firestore for account and application data, and Cloudinary for listing media and verification uploads. These providers process information to deliver their services under their own terms. Bank-catalog information comes from public third-party sources and links back to the source where available.",
          "We do not sell personal information. Information may be shared with the owner or renter involved in a booking, administrators handling review or disputes, service providers, or authorities where a valid legal request requires it.",
        ],
      },
      {
        title: "Retention and requests",
        paragraphs: [
          "Information is retained while needed to operate accounts, listings, bookings, reviews, disputes, and accountability records. Some dispute and review records may remain to preserve marketplace history. Backups and provider systems may retain data for additional periods.",
          "For access, correction, or deletion requests, contact hello@trusthome.ph from the account email and describe the request. We may need to verify account control. Deletion can be limited where records are needed for an active dispute, security, or legal obligations.",
        ],
      },
      {
        title: "Security and changes",
        paragraphs: [
          "The application uses authentication and Firestore access rules, but no online system is risk-free. The current test build has not completed an independent privacy or security audit. This notice may change as the system and its providers change.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Use",
    eyebrow: "Legal & data",
    intro: "These terms describe the intended use of TrustHome, a rental marketplace and public bank-property catalog project for the Philippines.",
    warning: "TrustHome is not a title registry, law firm, lender, escrow service, or guarantor of a rental or bank listing. Review the safety and data limits on the Privacy Policy and Data & Compliance pages before using the test build.",
    sections: [
      {
        title: "Accounts and responsibilities",
        paragraphs: [
          "Keep your account information accurate, protect your sign-in credentials, and use only accounts you are authorized to control. You are responsible for activity carried out through your account. TrustHome may suspend access where necessary for safety, fraud prevention, or these terms.",
        ],
      },
      {
        title: "Listings and verification",
        paragraphs: [
          "Owners must have authority to advertise a property and must provide accurate prices, location, availability, photos, and descriptions. Do not upload documents or images you do not have permission to use.",
          "A TrustHome review is a plausibility check, not a legal title search, identity guarantee, appraisal, inspection, or confirmation that a property is available. Users must verify ownership and terms independently before making decisions.",
        ],
      },
      {
        title: "Bookings, deposits, and disputes",
        paragraphs: [
          "A booking request is not confirmed until the owner confirms it in the application. Users should check dates and terms directly with each other. TrustHome does not collect, hold, transfer, or refund deposits. A transaction reference is a user-entered note, not proof that TrustHome received or secured money.",
          "Users may submit a dispute for review. TrustHome may review the information provided and take account or listing actions, but does not guarantee a particular outcome or recover funds. Public accountability information may appear for founded disputes.",
        ],
      },
      {
        title: "Bank catalog and third-party material",
        paragraphs: [
          "Bank-property information is collected from third-party public sources and may be incomplete, delayed, or inaccurate. TrustHome does not own those properties and does not guarantee price, availability, title, condition, financing, or source-site accuracy. Confirm details with the bank before acting.",
        ],
      },
      {
        title: "Acceptable use and content",
        paragraphs: [
          "Do not use the service to deceive, harass, threaten, impersonate, infringe intellectual property, evade access controls, upload malicious content, or expose another person’s private information. You retain rights in content you submit and grant TrustHome a limited permission to host, review, display, and process it for operating the service.",
        ],
      },
      {
        title: "Availability and changes",
        paragraphs: [
          "The service is provided as available. Features, data sources, and these terms may change. TrustHome may restrict or remove content or access where needed to protect users, comply with law, or maintain the service. Contact hello@trusthome.ph with questions.",
        ],
      },
    ],
  },
  "data-compliance": {
    title: "Data & Compliance",
    eyebrow: "Legal & data",
    intro: "This page summarizes the project’s data flows and safeguards. It is an operational disclosure, not a compliance certificate, audit report, or legal opinion.",
    warning: "Do not submit real identity or ownership documents to the current test build. A verified listing’s public Firestore record can return verification-document URL fields. Restricting those files and migrating existing records is required before production use.",
    sections: [
      {
        title: "Data flow",
        paragraphs: [
          "Firebase Authentication manages sign-in. Firestore stores user profiles, listings, private listing records, bookings, ratings, disputes, notifications, public profiles, and trust data. Cloudinary receives listing photos and verification uploads. The application also reads public bank catalog sources.",
          "Public listing reads expose approved listing documents. Booking records are intended to be readable by the renter, owner, and administrators; after confirmation, the booking includes the exact address for those participants. User preferences are stored in the browser.",
        ],
      },
      {
        title: "Current safeguards",
        paragraphs: [
          "The application uses authenticated roles, Firestore rules, approximate public map locations, owner/admin access checks for the listingPrivate collection, and status-based booking workflows. Recent rule deployments restrict several booking, dispute, and rating writes. These controls have received focused test-project checks but not a complete independent assessment.",
        ],
      },
      {
        title: "Known limitations before production",
        bullets: [
          "Verification-document URLs are currently present on publicly readable verified listing records; move them to a restricted store, migrate existing records, and test unauthenticated direct access.",
          "Overlapping booking confirmation still needs an authoritative concurrency-safe design; the current client check can be bypassed by direct writes.",
          "No independent penetration test, privacy impact assessment, formal compliance audit, or provider-contract review is claimed by this project.",
          "Retention periods, data-subject request handling, incident response, and operational ownership need formal approval before production.",
        ],
      },
      {
        title: "Requests and incident contact",
        paragraphs: [
          "For a data access, correction, deletion, or privacy concern, contact hello@trusthome.ph and identify the account involved. Do not email passwords, one-time codes, bank credentials, or copies of identity documents. Report suspected exposure promptly with the affected page or listing reference.",
        ],
      },
    ],
  },
  "ip-infringement": {
    title: "IP Infringement Reports",
    eyebrow: "Legal & data",
    intro: "TrustHome respects intellectual-property rights. Use this process to report listing text, photos, documents, or other material you believe is being used without authorization.",
    sections: [
      {
        title: "Submit a report",
        paragraphs: [
          "Email hello@trusthome.ph with the subject “IP infringement report.” Include enough detail for us to locate and assess the material. A report should include:",
        ],
        bullets: [
          "Your name and a reliable contact email.",
          "A description of the copyrighted work, trademark, or other right you represent.",
          "The exact TrustHome listing URL or other location of the material, plus the specific image, text, or file at issue.",
          "A short explanation of why you believe the use is unauthorized, and any supporting links or documents.",
          "A statement that the information is accurate and that you are the rights holder or authorized to act for them, plus your typed name as an electronic signature.",
        ],
      },
      {
        title: "Review and response",
        paragraphs: [
          "We may ask for clarification, temporarily restrict access to reported material, notify the uploader, or take account action where appropriate. The uploader may reply with an explanation and evidence of permission or ownership. We review reports individually and do not promise a particular outcome or response time.",
          "Please submit reports in good faith. Knowingly false or misleading reports may be rejected. This process is a project contact channel and does not replace any formal legal notice procedure that may apply to your situation.",
        ],
      },
    ],
  },
};

export default function LegalPage() {
  const { documentId } = useParams();
  const document = DOCUMENTS[documentId];

  return (
    <div className="legal-page">
      <PublicNav />
      <main className="legal-page__content">
        {document ? (
          <>
            <header className="legal-page__header">
              <p className="legal-page__eyebrow">{document.eyebrow}</p>
              <h1>{document.title}</h1>
              <p className="legal-page__intro">{document.intro}</p>
              <p className="legal-page__updated">Last updated {UPDATED}</p>
            </header>
            {document.warning && <aside className="legal-page__notice">{document.warning}</aside>}
            <div className="legal-page__sections">
              {document.sections.map((section) => (
                <section className="legal-page__section" key={section.title}>
                  <h2>{section.title}</h2>
                  {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets && (
                    <ul>
                      {section.bullets.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </section>
              ))}
            </div>
            <p className="legal-page__disclaimer">
              These project notices are informational drafts and should be reviewed by qualified counsel before production use.
            </p>
          </>
        ) : (
          <section className="legal-page__not-found">
            <p className="legal-page__eyebrow">Legal &amp; data</p>
            <h1>Document not found</h1>
            <Link to="/">Return to TrustHome</Link>
          </section>
        )}
      </main>
    </div>
  );
}