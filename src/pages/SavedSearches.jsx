import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, where } from "firebase/firestore";
import { Bell, Trash2 } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import "./UserPages.css";

export default function SavedSearches() {
  const { user } = useAuth();
  const [searches, setSearches] = useState([]);
  const [city, setCity] = useState("");
  const [type, setType] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(query(collection(db, "savedSearches"), where("userId", "==", user.uid)), (snapshot) => setSearches(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setError("Saved searches could not be loaded.")), [user.uid]);

  async function saveSearch(event) {
    event.preventDefault();
    if (!city.trim() && !type && !maxPrice) { setError("Add at least one filter before saving."); return; }
    try { await addDoc(collection(db, "savedSearches"), { userId: user.uid, filters: { city: city.trim(), type, maxPrice: maxPrice ? Number(maxPrice) : null }, createdAt: serverTimestamp() }); setCity(""); setType(""); setMaxPrice(""); setError(""); } catch { setError("This search could not be saved."); }
  }

  return <div className="user-page"><PublicNav /><main className="user-page__content"><header className="user-page__header"><div><p className="user-page__eyebrow">Your account</p><h1>Saved Searches</h1><p>Keep useful filters ready for your next property search.</p></div></header><form className="user-page__empty listing-form__grid" onSubmit={saveSearch}><div className="field"><label className="field__label" htmlFor="saved-city">City</label><input id="saved-city" className="field__input" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Cabuyao" /></div><div className="field"><label className="field__label" htmlFor="saved-type">Property type</label><select id="saved-type" className="field__input" value={type} onChange={(event) => setType(event.target.value)}><option value="">Any type</option><option>Apartment</option><option>House</option><option>Condo</option><option>Room</option></select></div><div className="field"><label className="field__label" htmlFor="saved-price">Maximum price</label><input id="saved-price" className="field__input" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} /></div><button type="submit" className="btn btn--primary"><Bell size={16} aria-hidden="true" /> Save search</button></form>{error && <p className="user-page__form-error" role="alert">{error}</p>}<div className="user-page__list">{searches.length === 0 ? <div className="user-page__empty">No saved searches yet.</div> : searches.map((search) => <article className="user-page__item" key={search.id}><div><h2>{search.filters?.city || "Any city"}</h2><p>{search.filters?.type || "Any type"}{search.filters?.maxPrice ? ` · Up to ${search.filters.maxPrice}` : ""}</p></div><button type="button" className="btn btn--danger" onClick={() => deleteDoc(doc(db, "savedSearches", search.id))}><Trash2 size={15} aria-hidden="true" /> Remove</button></article>)}</div></main></div>;
}
