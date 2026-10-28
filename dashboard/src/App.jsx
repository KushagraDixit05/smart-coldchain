import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Shell from "./components/Shell";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ShipmentList from "./pages/ShipmentList";
import ShipmentDetail from "./pages/ShipmentDetail";
import NewShipment from "./pages/NewShipment";
import Monitoring from "./pages/Monitoring";
import Blockchain from "./pages/Blockchain";
import ESP32Live from "./pages/ESP32Live";

export default function App() {
  return (
    <AuthProvider>
      <Shell>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shipments"
            element={
              <ProtectedRoute>
                <ShipmentList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shipments/new"
            element={
              <ProtectedRoute>
                <NewShipment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shipments/:id"
            element={
              <ProtectedRoute>
                <ShipmentDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/monitoring"
            element={
              <ProtectedRoute>
                <Monitoring />
              </ProtectedRoute>
            }
          />
          <Route
            path="/blockchain"
            element={
              <ProtectedRoute>
                <Blockchain />
              </ProtectedRoute>
            }
          />
          <Route
            path="/esp32"
            element={
              <ProtectedRoute>
                <ESP32Live />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Shell>
    </AuthProvider>
  );
}
