import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { Header, Screen } from "../features/dagangin/screen";
import type { Product } from "../features/dagangin/database";

type ProductForm = {
  name: string;
  sku: string;
  purchase_price: string;
  selling_price: string;
  stock: string;
  min_stock: string;
};

const emptyForm: ProductForm = {
  name: "",
  sku: "",
  purchase_price: "",
  selling_price: "",
  stock: "0",
  min_stock: "5",
};

const fields: {
  key: keyof ProductForm;
  label: string;
  placeholder: string;
  numeric?: boolean;
}[] = [
  { key: "name", label: "Nama produk", placeholder: "Contoh: Beras 5 kg" },
  { key: "sku", label: "SKU (opsional)", placeholder: "Contoh: BRS-001" },
  { key: "purchase_price", label: "Harga beli (Rp)", placeholder: "50000", numeric: true },
  { key: "selling_price", label: "Harga jual (Rp)", placeholder: "60000", numeric: true },
  { key: "stock", label: "Stok awal", placeholder: "10", numeric: true },
  { key: "min_stock", label: "Batas stok minimum", placeholder: "5", numeric: true },
];

const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export default function ProductsScreen() {
  const db = useSQLiteContext();

  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>({ ...emptyForm });

  const loadProducts = useCallback(async () => {
    try {
      const rows = await db.getAllAsync<Product>("SELECT * FROM products ORDER BY name COLLATE NOCASE");
      setProducts(rows);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Gagal membaca data produk.");
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void loadProducts();
    }, [loadProducts]),
  );

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalVisible(true);
  };

  const openEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku ?? "",
      purchase_price: String(product.purchase_price),
      selling_price: String(product.selling_price),
      stock: String(product.stock),
      min_stock: String(product.min_stock),
    });
    setModalVisible(true);
  };

  const saveProduct = async () => {
    if (saving) return;

    const name = form.name.trim();
    const sku = form.sku.trim() || null;

    if (!name) {
      Alert.alert("Validasi", "Nama produk wajib diisi.");
      return;
    }

    const numericFields = ["purchase_price", "selling_price", "stock", "min_stock"] as const;

    for (const key of numericFields) {
      const value = form[key].trim();
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        Alert.alert("Validasi", "Harga dan stok harus berupa bilangan bulat minimal 0.");
        return;
      }
    }

    const values = [name, sku, Number(form.purchase_price), Number(form.selling_price), Number(form.stock), Number(form.min_stock)] as const;

    setSaving(true);

    try {
      if (editingId !== null) {
        await db.runAsync(
          `UPDATE products
           SET name = ?, sku = ?, purchase_price = ?,
               selling_price = ?, stock = ?, min_stock = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [...values, editingId],
        );
      } else {
        await db.runAsync(
          `INSERT INTO products
           (name, sku, purchase_price, selling_price, stock, min_stock)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [...values],
        );
      }

      setModalVisible(false);
      await loadProducts();
    } catch (err) {
      console.error(err);
      const duplicate = String(err).includes("UNIQUE constraint failed");
      Alert.alert("Gagal menyimpan", duplicate ? "SKU tersebut sudah digunakan produk lain." : "Terjadi kesalahan saat menyimpan produk.");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = (product: Product) => {
    Alert.alert("Hapus produk", `Yakin ingin menghapus ${product.name}?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await db.runAsync("DELETE FROM products WHERE id = ?", product.id);
              await loadProducts();
            } catch (err) {
              console.error(err);
              Alert.alert("Gagal", "Produk tidak berhasil dihapus.");
            }
          })();
        },
      },
    ]);
  };

  const filtered = products.filter((product) => {
    const keyword = search.toLowerCase();
    return product.name.toLowerCase().includes(keyword) || (product.sku ?? "").toLowerCase().includes(keyword);
  });

  return (
    <Screen>
      <Header title="Produk & stok" subtitle="Kelola barang dan pantau persediaan usaha." />

      <View style={s.toolbar}>
        <View>
          <Text style={s.count}>{products.length} Produk</Text>
          <Text style={s.muted}>Tersimpan di perangkat</Text>
        </View>

        <Pressable style={s.addButton} onPress={openAdd}>
          <Ionicons name="add" size={19} color="#FFFFFF" />
          <Text style={s.addText}>Tambah</Text>
        </Pressable>
      </View>

      <TextInput style={s.search} placeholder="Cari nama produk atau SKU..." placeholderTextColor="#82928A" value={search} onChangeText={setSearch} />

      {loading && <Text style={s.message}>Memuat produk...</Text>}
      {error && <Text style={s.error}>{error}</Text>}

      {!loading && !error && filtered.length === 0 && (
        <View style={s.empty}>
          <Ionicons name="cube-outline" size={38} color="#82928A" />
          <Text style={s.emptyTitle}>{products.length === 0 ? "Belum ada produk" : "Produk tidak ditemukan"}</Text>
          <Text style={s.muted}>{products.length === 0 ? "Tambahkan produk pertama untuk memulai." : "Coba gunakan kata kunci lain."}</Text>
        </View>
      )}

      {filtered.map((product) => {
        const lowStock = product.stock <= product.min_stock;

        return (
          <View key={product.id} style={s.card}>
            <View style={s.productHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.muted}>SKU: {product.sku || "-"}</Text>
              </View>

              <Text style={lowStock ? s.stockLow : s.stockOk}>Stok: {product.stock}</Text>
            </View>

            <View style={s.priceRow}>
              <View>
                <Text style={s.muted}>Harga beli</Text>
                <Text style={s.price}>{rupiah(product.purchase_price)}</Text>
              </View>
              <View>
                <Text style={s.muted}>Harga jual</Text>
                <Text style={s.price}>{rupiah(product.selling_price)}</Text>
              </View>
            </View>

            <View style={s.actions}>
              <Pressable style={s.editButton} onPress={() => openEdit(product)}>
                <Ionicons name="pencil-outline" size={16} color="#17634D" />
                <Text style={s.editText}>Edit</Text>
              </Pressable>

              <Pressable style={s.deleteButton} onPress={() => deleteProduct(product)}>
                <Ionicons name="trash-outline" size={16} color="#B14545" />
                <Text style={s.deleteText}>Hapus</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) setModalVisible(false);
        }}
      >
        <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={s.modal}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={s.modalTitle}>{editingId === null ? "Tambah Produk" : "Edit Produk"}</Text>

              {fields.map((field) => (
                <View key={field.key} style={s.field}>
                  <Text style={s.label}>{field.label}</Text>
                  <TextInput
                    style={s.input}
                    placeholder={field.placeholder}
                    placeholderTextColor="#82928A"
                    keyboardType={field.numeric ? "number-pad" : "default"}
                    value={form[field.key]}
                    onChangeText={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: value,
                      }))
                    }
                  />
                </View>
              ))}

              <Pressable style={[s.saveButton, saving && { opacity: 0.6 }]} onPress={() => void saveProduct()} disabled={saving}>
                <Text style={s.saveText}>{saving ? "Menyimpan..." : "Simpan Produk"}</Text>
              </Pressable>

              <Pressable onPress={() => setModalVisible(false)} disabled={saving} style={s.cancelButton}>
                <Text style={s.cancelText}>Batal</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const s = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 20,
  },
  count: { fontSize: 19, fontWeight: "800", color: "#173B30" },
  muted: { fontSize: 12, color: "#76867D", marginTop: 4 },
  addButton: {
    backgroundColor: "#17634D",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
    paddingVertical: 12,
    borderRadius: 13,
    gap: 6,
  },
  addText: { color: "#FFFFFF", fontWeight: "700" },
  search: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7DE",
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
    color: "#173B30",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1E7DE",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  productHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  productName: { fontSize: 16, fontWeight: "800", color: "#173B30" },
  stockLow: {
    backgroundColor: "#FFF1DA",
    color: "#9B6015",
    padding: 7,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: "700",
  },
  stockOk: {
    backgroundColor: "#E7F4EC",
    color: "#17634D",
    padding: 7,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 18,
    marginBottom: 14,
  },
  price: {
    fontSize: 15,
    fontWeight: "800",
    color: "#173B30",
    marginTop: 4,
  },
  actions: { flexDirection: "row", gap: 10 },
  editButton: {
    flex: 1,
    backgroundColor: "#EDF7F0",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: "#FDF0F0",
    padding: 12,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  editText: { color: "#17634D", fontWeight: "700" },
  deleteText: { color: "#B14545", fontWeight: "700" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 9 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#173B30" },
  message: { textAlign: "center", marginTop: 20, color: "#76867D" },
  error: { textAlign: "center", marginTop: 20, color: "#B14545" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#F5F7F1",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    padding: 24,
    paddingBottom: 35,
  },
  modalTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#173B30",
    marginBottom: 20,
  },
  field: { marginBottom: 14 },
  label: {
    color: "#173B30",
    fontWeight: "700",
    fontSize: 13,
    marginBottom: 7,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCE5DA",
    borderRadius: 11,
    padding: 13,
    color: "#173B30",
  },
  saveButton: {
    backgroundColor: "#17634D",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  saveText: { color: "#FFFFFF", fontWeight: "800" },
  cancelButton: { padding: 17, alignItems: "center" },
  cancelText: { color: "#76867D", fontWeight: "700" },
});
