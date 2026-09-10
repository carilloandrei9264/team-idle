import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { uploadToCloudinary } from "../uploadImage";
import "./UserPages.css";

const PROPERTY_TYPES = ["Apartment", "House", "Condo", "Room"];

export default function CreateListing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Apartment",
    city: "",
    price: "",
    pricePeriod: "month",
    floorArea: "",
    lotArea: "",
  });
  const [photos, setPhotos] = useState([]);
  const [verificationDoc, setVerificationDoc] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handlePhotos(event) {
    setPhotos(Array.from(event.target.files || []).slice(0, 5));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!verificationDoc) {
      setError("Upload an ownership or ID document so an admin can review this listing.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const [verificationDocUrl, photoUrls] = await Promise.all([
        uploadToCloudinary(verificationDoc),
        Promise.all(photos.map((photo) => uploadToCloudinary(photo))),
      ]);

      await addDoc(collection(db, "listings"), {
        ownerId: user.uid,
        ownerName: profile?.name || user.displayName || user.email,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        city: form.city.trim(),
        price: Number(form.price),
        pricePeriod: form.pricePeriod,
        floorArea: form.floorArea ? Number(form.floorArea) : null,
        lotArea: form.lotArea ? Number(form.lotArea) : null,
        verificationStatus: "pending",
        verificationDocUrl,
        photoUrls,
        createdAt: serverTimestamp(),
      });
      navigate("/my-listings", { replace: true });
    } catch (uploadError) {
      setError(uploadError.message || "Your listing could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to="/my-listings" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> My listings</Link>
        <header className="user-page__header">
          <div>
            <p className="user-page__eyebrow">List a property</p>
            <h1>Create listing</h1>
            <p>Your listing will stay private until an admin reviews the submitted document.</p>
          </div>
        </header>

        <form className="listing-form" onSubmit={handleSubmit}>
          <section className="user-page__empty listing-form__section">
            <h2>Property details</h2>
            <div className="listing-form__grid">
              <div className="field listing-form__wide">
                <label className="field__label" htmlFor="title">Listing title</label>
                <input id="title" name="title" className="field__input" value={form.title} onChange={updateField} placeholder="e.g. Bright two-bedroom apartment" required />
              </div>
              <div className="field listing-form__wide">
                <label className="field__label" htmlFor="description">Description</label>
                <textarea id="description" name="description" className="listing-form__textarea" value={form.description} onChange={updateField} rows={5} placeholder="Tell renters what makes this property a good fit." required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="type">Property type</label>
                <select id="type" name="type" className="field__input" value={form.type} onChange={updateField}>{PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="city">City</label>
                <input id="city" name="city" className="field__input" value={form.city} onChange={updateField} placeholder="e.g. Cabuyao" required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="price">Price</label>
                <input id="price" name="price" type="number" min="1" className="field__input" value={form.price} onChange={updateField} placeholder="₱0" required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="pricePeriod">Price period</label>
                <select id="pricePeriod" name="pricePeriod" className="field__input" value={form.pricePeriod} onChange={updateField}><option value="month">Per month</option><option value="day">Per day</option></select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="floorArea">Floor area (sqm)</label>
                <input id="floorArea" name="floorArea" type="number" min="0" className="field__input" value={form.floorArea} onChange={updateField} placeholder="Optional" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="lotArea">Lot area (sqm)</label>
                <input id="lotArea" name="lotArea" type="number" min="0" className="field__input" value={form.lotArea} onChange={updateField} placeholder="Optional" />
              </div>
            </div>
          </section>

          <section className="user-page__empty listing-form__section">
            <h2>Photos and verification</h2>
            <p className="listing-form__hint">Photos help renters understand the space. The ownership or ID document is only for review.</p>
            <div className="listing-form__uploads">
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Property photos</span>
                <small>{photos.length ? `${photos.length} selected` : "Up to 5 images"}</small>
                <input type="file" accept="image/*" multiple onChange={handlePhotos} />
              </label>
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Ownership or ID document</span>
                <small>{verificationDoc?.name || "Required for review"}</small>
                <input type="file" accept="image/*,.pdf" onChange={(event) => setVerificationDoc(event.target.files?.[0] || null)} required />
              </label>
            </div>
          </section>

          {error && <p className="user-page__form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn--primary listing-form__submit" disabled={submitting}>
            {submitting ? "Uploading and submitting..." : "Submit for review"}
          </button>
        </form>
      </main>
    </div>
  );
}