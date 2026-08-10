import { useEffect, useState } from "react";
import { api, RANKS, CATEGORIES, API } from "@/lib/api";
import { toast } from "sonner";
import RankBadge from "@/components/RankBadge";
import { Plus, Trash2, Upload, Edit3 } from "lucide-react";

const empty = {
  name: "",
  description: "",
  category: "Items",
  rank: "F",
  price: 100,
  stock: -1,
  image_path: "",
};

export default function AdminItemsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data } = await api.get("/items");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({ ...f, image_path: data.path }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/items/${editingId}`, form);
        toast.success("Item updated");
      } else {
        await api.post("/items", form);
        toast.success("Item created");
      }
      setForm(empty);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Save failed");
    }
  };

  const onEdit = (it) => {
    setForm({
      name: it.name,
      description: it.description || "",
      category: it.category,
      rank: it.rank,
      price: it.price,
      stock: it.stock,
      image_path: it.image_path || "",
    });
    setEditingId(it.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onDelete = async (id) => {
    if (!window.confirm("Delete this item?")) return;
    await api.delete(`/items/${id}`);
    toast.success("Item deleted");
    load();
  };

  const token = localStorage.getItem("dokkaebi_token") || "";
  const previewSrc = form.image_path
    ? `${API}/files/${form.image_path}?auth=${encodeURIComponent(token)}`
    : null;

  return (
    <div className="space-y-8 animate-boot">
      <div>
        <div className="inline-block px-3 py-1 rounded-full glass-panel text-[9px] tracking-[0.3em] uppercase text-sky-300 mb-3">
          [ DM CONSOLE // ITEM FORGE ]
        </div>
        <h1 className="font-display font-black text-4xl text-sky-100 tracking-tight">Item Management</h1>
      </div>

      <form onSubmit={onSave} className="glass-panel rounded-2xl p-6 grid md:grid-cols-2 gap-5">
        <div className="md:col-span-2 flex items-center justify-between">
          <h2 className="font-display text-lg text-sky-100">
            {editingId ? "Edit Item" : "Create New Item"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={() => { setForm(empty); setEditingId(null); }}
              className="text-xs font-mono text-sky-400 hover:text-sky-100 uppercase tracking-widest"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Name</label>
          <input
            required
            data-testid="item-form-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Category</label>
          <select
            data-testid="item-form-category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Rank</label>
          <select
            data-testid="item-form-rank"
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Price (coins)</label>
          <input
            type="number"
            min="0"
            required
            data-testid="item-form-price"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div>
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Stock (-1 = unlimited)</label>
          <input
            type="number"
            min="-1"
            data-testid="item-form-stock"
            value={form.stock}
            onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value) })}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Description</label>
          <textarea
            data-testid="item-form-description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-sky-950/50 border border-sky-400/20 rounded-lg text-sky-100 font-mono text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[9px] uppercase tracking-widest text-sky-400 mb-2 font-mono">Image</label>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-100 font-mono text-xs uppercase tracking-widest transition-colors">
              <Upload size={14} />
              {uploading ? "Uploading..." : "Upload Image"}
              <input
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
                data-testid="item-form-image-input"
              />
            </label>
            {previewSrc && (
              <img
                src={previewSrc}
                alt="preview"
                className="w-16 h-16 object-cover rounded-lg border border-sky-400/30"
              />
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            data-testid="item-form-submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-500 hover:bg-sky-400 text-sky-950 font-display font-bold uppercase text-xs tracking-widest rounded-lg transition-colors"
          >
            <Plus size={14} />
            {editingId ? "Update Item" : "Create Item"}
          </button>
        </div>
      </form>

      {/* List */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-sky-400/20 font-mono text-[10px] uppercase tracking-widest text-sky-400">
          [ Existing Items ({items.length}) ]
        </div>
        <div className="divide-y divide-sky-400/10">
          {items.length === 0 && (
            <div className="p-8 text-center font-mono text-sm text-sky-400/70">No items yet.</div>
          )}
          {items.map((it) => (
            <div key={it.id} className="p-4 flex items-center gap-4 hover:bg-sky-500/5" data-testid={`admin-item-${it.id}`}>
              <RankBadge rank={it.rank} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sky-100 truncate">{it.name}</div>
                <div className="text-[10px] font-mono text-sky-400/70 uppercase tracking-widest">
                  {it.category} · {it.price} coins · {it.stock === -1 ? "∞" : it.stock} stock
                </div>
              </div>
              <button onClick={() => onEdit(it)} className="p-2 text-sky-300 hover:text-sky-100 hover:bg-sky-500/10 rounded-lg transition-colors" data-testid={`edit-item-${it.id}`}>
                <Edit3 size={14} />
              </button>
              <button onClick={() => onDelete(it.id)} className="p-2 text-red-400 hover:text-red-200 hover:bg-red-500/10 rounded-lg transition-colors" data-testid={`delete-item-${it.id}`}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
