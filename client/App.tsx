import {
    BrowserRouter as Router,
    Routes,
    Route,
} from "react-router-dom";
import { ThemeProvider } from "@/client/components/theme-provider";
import { Toaster } from "@/client/components/ui/sonner";
import { AdminLayout } from "@/client/components/admin/layout";
import { VisaLandingPage } from "./pages/visa/VisaLandingPage";
import { VisaBookingPage } from "./pages/visa/VisaBookingPage";
import { JoinPage } from "./pages/visa/JoinPage";
import { OrderStatusPage } from "./pages/visa/OrderStatusPage";
import { AuthPage } from "./pages/auth/AuthPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { VisaSettingsPage } from "./pages/visa/VisaSettingsPage";
import { VisaOrdersPage } from "./pages/visa/VisaOrdersPage";
import { VisaPayCodePage } from "./pages/visa/VisaPayCodePage";

export default function App() {
    return (
        <ThemeProvider defaultTheme="light">
            <Router>
                <Routes>
                    <Route path="/" element={<VisaLandingPage />} />
                    <Route path="/apply" element={<VisaBookingPage />} />
                    <Route path="/join" element={<JoinPage />} />
                    <Route path="/join/:token" element={<JoinPage />} />
                    <Route path="/order" element={<OrderStatusPage />} />
                    <Route path="/order/:token" element={<OrderStatusPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route element={<AdminLayout />}>
                        <Route path="/admin" element={<VisaOrdersPage />} />
                        <Route path="/visa-settings" element={<VisaSettingsPage />} />
                        <Route path="/visa-orders" element={<VisaOrdersPage />} />
                        <Route path="/visa-pay-codes" element={<VisaPayCodePage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                </Routes>
            </Router>
            <Toaster />
        </ThemeProvider>
    );
}
