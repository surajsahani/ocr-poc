"use client";
import { Provider } from "react-redux";
import { store } from "@/redux/store";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.min.css";
import MainForm from "@/components/MainForm";

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section class="main-container text-center">
        <Provider store={store}>
          <MainForm />
        </Provider>
      </section>
      <ToastContainer
        position="bottom-right"
        autoClose={1000} //1s
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss={false}
        pauseOnHover={false}
        draggable
        draggablePercent={80}
        theme="light"
      />
    </>
  );
}
