import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { uploadToCloudinary } from "../uploadImage";
import "./UserPages.css";

const PROPERTY_TYPES = ["Apartment", "House", "Condo", "Room"];

export default function EditListing() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verificationDoc, setVerificationDoc] = useState(null);

  useEffect(() => {
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (!snapshot.exists()) {
        setError("This listing could not be found.");
      } else if (snapshot.data().ownerId !== user.uid) {
        setError("You can only edit your own listings.");
      } else {
        const data = snapshot.data();
        setForm({ title: data.title || "", description: data.description || "", type: data.type || "Apartment", city: data.city || "", price: data.price || "", pricePeriod: data.pricePeriod || "month", floorArea: data.floorArea || "", lotArea: data.lotArea || "" });
      }
      setLoading(false);
    }).catch(() => {
      setError("This listing could not be loaded.");
      setLoading(false);
    });
  }, [listingId, user.uid]);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const verificationDocUrl = verificationDoc ? await uploadToCloudinary(verificationDoc) : undefined;
      await updateDoc(doc(db, "listings", listingId), {
        title: form.title.trim(), description: form.description.trim(), type: form.type, city: form.city.trim(), price: Number(form.price), pricePeriod: form.pricePeriod,
        floorArea: form.floorArea ? Number(form.floorArea) : null, lotArea: form.lotArea ? Number(form.lotArea) : null,
        verificationStatus: "pending", updatedAt: serverTimestamp(),
        ...(verificationDocUrl ? { verificationDocUrl } : {}),
      });
      navigate(`/listings/${listingId}`, { replace: true });
    } catch {
      setError("Your changes could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content user-page__content--form">
        <Link to={`/listings/${listingId}`} className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Listing details</Link>
        <header className="user-page__header"><div><p className="user-page__eyebrow">Owner tools</p><h1>Edit listing</h1><p>Saving changes sends this listing back for review.</p></div></header>
        {loading ? <p className="user-page__empty">Loading listing...</p> : error && !form ? <div className="user-page__empty" role="alert"><h2>Unable to edit listing</h2><p>{error}</p></div> : (
          <form className="listing-form" onSubmit={handleSubmit}>
            <section className="user-page__empty listing-form__section">
              <div className="listing-form__grid">
                <div className="field listing-form__wide"><label className="field__label" htmlFor="edit-title">Listing title</label><input id="edit-title" name="title" className="field__input" value={form.title} onChange={updateField} required /></div>
                <div className="field listing-form__wide"><label className="field__label" htmlFor="edit-description">Description</label><textarea id="edit-description" name="description" className="listing-form__textarea" rows={5} value={form.description} onChange={updateField} required /></div>
                <div className="field"><label className="field__label" htmlFor="edit-type">Property type</label><select id="edit-type" name="type" className="field__input" value={form.type} onChange={updateField}>{PROPERTY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
                <div className="field"><label className="field__label" htmlFor="edit-city">City</label><input id="edit-city" name="city" className="field__input" value={form.city} onChange={updateField} required /></div>
                <div className="field"><label className="field__label" htmlFor="edit-price">Price</label><input id="edit-price" name="price" type="number" min="1" className="field__input" value={form.price} onChange={updateField} required /></div>
                <div className="field"><label className="field__label" htmlFor="edit-period">Price period</label><select id="edit-period" name="pricePeriod" className="field__input" value={form.pricePeriod} onChange={updateField}><option value="month">Per month</option><option value="day">Per day</option></select></div>
                <div className="field"><label className="field__label" htmlFor="edit-floor">Floor area (sqm)</label><input id="edit-floor" name="floorArea" type="number" min="0" className="field__input" value={form.floorArea} onChange={updateField} /></div>
                <div className="field"><label className="field__label" htmlFor="edit-lot">Lot area (sqm)</label><input id="edit-lot" name="lotArea" type="number" min="0" className="field__input" value={form.lotArea} onChange={updateField} /></div>
              </div>
              <label className="listing-form__upload listing-form__upload--inline">
                <span>Replace ownership or ID document</span>
                <small>{verificationDoc?.name || "Optional if the document is still valid"}</small>
                <input type="file" accept="image/*,.pdf" onChange={(event) => setVerificationDoc(event.target.files?.[0] || null)} />
              </label>
            </section>
            {error && <p className="user-page__form-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn--primary listing-form__submit" disabled={saving}>{saving ? "Saving..." : "Save and submit for review"}</button>
          </form>
        )}
      </main>
    </div>
  );
}