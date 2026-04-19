import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-md text-sm font-medium ${
      isActive ? "bg-brand-100 text-brand-700" : "text-slate-600 hover:text-slate-900"
    }`;

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-brand-600">
          <span className="text-2xl">🐾</span> Petbook
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
                <Link to="/subscribe" className="hidden rounded-md bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-100 md:inline-block">
                  Upgrade $10/yr
                </Link>
              )}
              <Link to="/profile" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                {user.display_name || user.email}
              </Link>
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="btn-secondary text-sm"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary text-sm">Log in</Link>
              <Link to="/register" className="btn-primary text-sm">Join</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
