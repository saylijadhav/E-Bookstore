import { Route, Routes } from "react-router-dom";
import { StoreProvider } from "./store";
import Navbar from "./components/Navbar";
import GenreSidebar from "./components/GenreSidebar";
import Toast from "./components/Toast";
import Catalogue from "./pages/Catalogue";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import { OrderDetail, Orders } from "./pages/Orders";
import { Wishlist, Writers } from "./pages/Library";
import Auth from "./pages/Auth";

export default function App() {
  return (
    <StoreProvider>
      <div className="min-h-screen">
        <Navbar />
        <div className="mx-auto flex max-w-screen-2xl">
          <GenreSidebar />
          <main className="min-w-0 flex-1 p-4 sm:p-6">
            <Routes>
              <Route path="/" element={<Catalogue />} />
              <Route path="/category/:slug" element={<Catalogue />} />
              <Route path="/books/:id" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/wishlist" element={<Wishlist />} />
              <Route path="/writers" element={<Writers />} />
              <Route path="/login" element={<Auth mode="login" />} />
              <Route path="/register" element={<Auth mode="register" />} />
              <Route path="*" element={<p className="py-10 text-center text-slate-400">Page not found.</p>} />
            </Routes>
          </main>
        </div>
        <Toast />
      </div>
    </StoreProvider>
  );
}
