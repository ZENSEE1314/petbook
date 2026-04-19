import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { SiteProvider } from "./site";
import { Nav } from "./components/Nav";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Admin } from "./pages/Admin";
import { AnimalDetail } from "./pages/AnimalDetail";
import { Cart } from "./pages/Cart";
import { Feed } from "./pages/Feed";
import { Guide } from "./pages/Guide";
import { ListingDetail } from "./pages/ListingDetail";
import { Listings } from "./pages/Listings";
import { Login } from "./pages/Login";
import { NewListing } from "./pages/NewListing";
import { OrderDetail, Orders } from "./pages/Orders";
import { ProductDetail } from "./pages/ProductDetail";
import { Profile } from "./pages/Profile";
import { Register } from "./pages/Register";
import { Shop } from "./pages/Shop";
import { Subscribe } from "./pages/Subscribe";

export default function App() {
  return (
    <BrowserRouter>
      <SiteProvider>
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              <Route path="/guide" element={<Guide />} />
              <Route path="/guide/:slug" element={<AnimalDetail />} />

              <Route path="/shop" element={<Shop />} />
              <Route path="/shop/:slug" element={<ProductDetail />} />
              <Route path="/cart" element={<Cart />} />

              <Route path="/listings" element={<Listings />} />
              <Route path="/listings/new" element={
                <ProtectedRoute requirePaid><NewListing /></ProtectedRoute>
              } />
              <Route path="/listings/:id" element={<ListingDetail />} />

              <Route path="/subscribe" element={<Subscribe />} />

              <Route path="/orders" element={
                <ProtectedRoute><Orders /></ProtectedRoute>
              } />
              <Route path="/orders/:id" element={
                <ProtectedRoute><OrderDetail /></ProtectedRoute>
              } />
              <Route path="/profile" element={
                <ProtectedRoute><Profile /></ProtectedRoute>
              } />

              <Route path="/admin/*" element={
                <ProtectedRoute requireAdmin><Admin /></ProtectedRoute>
              } />

              <Route path="*" element={
                <div className="p-10 text-center text-slate-500">
                  Page not found. <a href="/" className="text-brand-600 underline">Go home</a>.
                </div>
              } />
            </Routes>
          </main>
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
            Petbook · social · guide · shop · listings
          </footer>
        </div>
      </AuthProvider>
      </SiteProvider>
    </BrowserRouter>
  );
}
