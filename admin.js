import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDxiDR4vsRepajy4BB-m63wR_wUd3vJsU4",
  authDomain: "patitas-de-lana.firebaseapp.com",
  projectId: "patitas-de-lana",
  storageBucket: "patitas-de-lana.firebasestorage.app",
  messagingSenderId: "590397660401",
  appId: "1:590397660401:web:ad6a94eaf8a235a5d55d50"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const $ = (sel) => document.querySelector(sel);

const loginSection = $('#loginSection');
const adminSection = $('#adminSection');
const loginForm = $('#loginForm');
const loginBtn = $('#loginBtn');
const loginMessage = $('#loginMessage');
const productForm = $('#productForm');
const publishBtn = $('#publishBtn');
const productMessage = $('#productMessage');
const logoutBtn = $('#logoutBtn');

function setMessage(el, text, type = '') {
  el.textContent = text;
  el.className = `message${type ? ' ' + type : ''}`;
}

function showAdmin() {
  loginSection.classList.add('hidden');
  adminSection.classList.remove('hidden');
}

function showLogin() {
  adminSection.classList.add('hidden');
  loginSection.classList.remove('hidden');
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    showAdmin();
  } else {
    showLogin();
  }
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;

  if (!email || !password) {
    setMessage(loginMessage, 'Ingresa correo y contraseña.', 'error');
    return;
  }

  loginBtn.disabled = true;
  setMessage(loginMessage, 'Iniciando sesión...');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
    setMessage(loginMessage, '');
  } catch (err) {
    console.error(err);
    setMessage(loginMessage, 'Credenciales inválidas o error de conexión.', 'error');
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
  } catch (err) {
    console.error(err);
  }
});

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = $('#productName').value.trim();
  const price = Number($('#productPrice').value);
  const file = $('#productImage').files[0];

  if (!name || !file || !Number.isFinite(price) || price < 0) {
    setMessage(productMessage, 'Completa todos los campos correctamente.', 'error');
    return;
  }

  publishBtn.disabled = true;
  setMessage(productMessage, 'Subiendo imagen...');

  try {
    const safeName = file.name.replace(/[^\w.\-]+/g, '_');
    const storagePath = `productos/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const imageUrl = await getDownloadURL(storageRef);

    setMessage(productMessage, 'Guardando producto...');

    await addDoc(collection(db, 'productos'), {
      nombre: name,
      precio: price,
      imagen: imageUrl,
      creadoEn: serverTimestamp(),
    });

    productForm.reset();
    setMessage(productMessage, '¡Producto publicado con éxito!', 'success');
    alert('¡Producto publicado con éxito!');
  } catch (err) {
    console.error(err);
    setMessage(productMessage, 'Error al publicar el producto.', 'error');
    alert('Error al publicar el producto: ' + (err?.message || 'desconocido'));
  } finally {
    publishBtn.disabled = false;
  }
});
