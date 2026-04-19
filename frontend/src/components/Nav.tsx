import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? "bg-brand-100 text-brand-700" : "text-slate-600 hover:text-slate-900"
    }`;

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block rounded-md px-3 py-2 text-sm font-medium ${
      isActive ? "bg-brand-100 text-brand-700" : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-600">
          <span className="text-2xl">🐾</span>
          <span>Petbook</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={linkClass}>Feed</NavLink>
          <NavLink to="/guide" className={linkClass}>Pet Guide</NavLink>
          <NavLink to="/shop" className={linkClass}>Shop</NavLink>
          <NavLink to="/listings" className={linkClass}>Pet Listings</NavLink>
          {user?.is_admin && <NavLink to="/admin" className={linkClass}>Admin</NavLink>}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {!user.is_paid && (
                <Link
                  to="/subscribe"
                  className="hidden rounded-md bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 md:inline-block"
                >
                  Upgrade $10/yr
                </Link>
              )}
              <Link
                to="/profile"
                className="hidden max-w-[160px] truncate text-sm font-medium text-slate-700 hover:text-slate-900 sm:inline-block"
              >
                {user.display_name || user.email}
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="btn-secondary hidden text-sm sm:inline-flex"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary hidden text-sm sm:inline-flex">Log in</Link>
              <Link to="/register" className="btn-primary text-sm">Join</Link>
            </>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
            className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="17" y2="6" />
                  <line x1="3" y1="10" x2="17" y2="10" />
                  <line x1="3" y1="14" x2="17" y2="14" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-slate-200 bg-white px-4 py-2 md:hidden" onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end className={mobileLinkClass}>Feed</NavLink>
          <NavLink to="/guide" className={mobileLinkClass}>Pet Guide</NavLink>
          <NavLink to="/shop" className={mobileLinkClass}>Shop</NavLink>
          <NavLink to="/listings" className={mobileLinkClass}>Pet Listings</NavLink>
          {user?.is_admin && <NavLink to="/admin" className={mobileLinkClass}>Admin</NavLink>}
          {user && (
            <>
              <div className="my-2 border-t border-slate-200" />
              <NavLink to="/profile" className={mobileLinkClass}>Profile</NavLink>
              <NavLink to="/orders" className={mobileLinkClass}>My orders</NavLink>
              {!user.is_paid && (
                <NavLink to="/subscribe" className={mobileLinkClass}>Upgrade $10/yr</NavLink>
              )}
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                  setMenuOpen(false);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Log out
              </button>
            </>
          )}
          {!user && (
            <>
              <div className="my-2 border-t border-slate-200" />
              <NavLink to="/login" className={mobileLinkClass}>Log in</NavLink>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
