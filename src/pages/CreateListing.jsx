import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ArrowLeft, Upload } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { countWords, validateListingForm } from "../lib/listingValidation";
import { uploadToCloudinary } from "../uploadImage";
import "./UserPages.css";

const PROPERTY_TYPES = ["Room", "Studio", "Apartment", "House", "Condo"];
const AMENITIES = ["Parking", "WiFi", "Furnished", "Pets allowed", "Air conditioning", "Security"];

export default function CreateListing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "Apartment",
    address: "",
    city: "",
    price: "",
    pricePeriod: "month",
    bedrooms: "",
    bathrooms: "",
    floorArea: "",
    lotArea: "",
    availabilityDate: "",
    amenities: [],
  });
  const [photos, setPhotos] = useState([]);
  const [ownershipDocument, setOwnershipDocument] = useState(null);
  const [governmentId, setGovernmentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handlePhotos(event) {
    setPhotos(Array.from(event.target.files || []).slice(0, 8));
  }

  function toggleAmenity(amenity) {
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(amenity)
        ? current.amenities.filter((item) => item !== amenity)
        : [...current.amenities, amenity],
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const validationErrors = validateListingForm({ form, photos, ownershipDocument, governmentId });
    if (validationErrors.length) {
      setError(validationErrors.join(" "));
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const [ownershipDocumentUrl, governmentIdUrl, photoUrls] = await Promise.all([
        uploadToCloudinary(ownershipDocument, "raw"),
        uploadToCloudinary(governmentId),
        Promise.all(photos.map((photo) => uploadToCloudinary(photo))),
      ]);

      await addDoc(collection(db, "listings"), {
        ownerId: user.uid,
        ownerName: profile?.name || user.displayName || user.email,
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        address: form.address.trim(),
        city: form.city.trim(),
        price: Number(form.price),
        pricePeriod: form.pricePeriod,
        bedrooms: Number(form.bedrooms),
        bathrooms: Number(form.bathrooms),
        floorArea: form.floorArea ? Number(form.floorArea) : null,
        lotArea: form.lotArea ? Number(form.lotArea) : null,
        availabilityDate: form.availabilityDate,
        amenities: form.amenities,
        verificationStatus: "pending",
        ownershipDocumentUrl,
        governmentIdUrl,
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
                <textarea id="description" name="description" className="listing-form__textarea" value={form.description} onChange={updateField} rows={8} placeholder="Describe the property accurately, including layout, condition, access, and nearby landmarks." required />
                <small className="listing-form__hint">{countWords(form.description)} words (150-400 required)</small>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="type">Property type</label>
                <select id="type" name="type" className="field__input" value={form.type} onChange={updateField}>{PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="address">Address or area</label>
                <input id="address" name="address" className="field__input" value={form.address} onChange={updateField} placeholder="Exact address or neighborhood" required />
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
                <label className="field__label" htmlFor="bedrooms">Bedrooms</label>
                <input id="bedrooms" name="bedrooms" type="number" min="0" className="field__input" value={form.bedrooms} onChange={updateField} required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="bathrooms">Bathrooms</label>
                <input id="bathrooms" name="bathrooms" type="number" min="0" step="0.5" className="field__input" value={form.bathrooms} onChange={updateField} required />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="availabilityDate">Available from</label>
                <input id="availabilityDate" name="availabilityDate" type="date" className="field__input" value={form.availabilityDate} onChange={updateField} required />
              </div>
              <div className="field listing-form__wide">
                <span className="field__label">Amenities</span>
                <div className="listing-form__amenities">
                  {AMENITIES.map((amenity) => <label className="listing-form__amenity" key={amenity}><input type="checkbox" checked={form.amenities.includes(amenity)} onChange={() => toggleAmenity(amenity)} />{amenity}</label>)}
                </div>
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
            <p className="listing-form__hint">Upload at least 4 photos. Submit one ownership document and one government-issued photo ID. Documents are private to the review team.</p>
            <div className="listing-form__uploads">
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Property photos</span>
                <small>{photos.length ? `${photos.length} selected` : "At least 4 images"}</small>
                <input type="file" accept="image/*" multiple onChange={handlePhotos} />
              </label>
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Ownership document</span>
                <small>{ownershipDocument?.name || "Title, deed, or tax bill"}</small>
                <input type="file" accept="image/*,.pdf" onChange={(event) => setOwnershipDocument(event.target.files?.[0] || null)} required />
              </label>
              <label className="listing-form__upload">
                <Upload size={18} aria-hidden="true" />
                <span>Government photo ID</span>
                <small>{governmentId?.name || "Required for review"}</small>
                <input type="file" accept="image/*" onChange={(event) => setGovernmentId(event.target.files?.[0] || null)} required />
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