import React, { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Building2,
  CheckCircle2,
  FileText,
  Hammer,
  IdCard,
  Search,
  TriangleAlert,
  UserPlus,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";

const LOGO_URL = "/logo-arauco.png";
const STORAGE_KEYS = {
  tools: "panol-tools",
  workers: "panol-workers",
  movimientos: "panol-movimientos",
};

const initialTools = [
  { id: 1, codigo: "TL-001", nombre: "Taladro inalámbrico", categoria: "Eléctrica", stockTotal: 4, stockDisponible: 4, stockDanado: 0 },
  { id: 2, codigo: "TL-002", nombre: 'Llave francesa 12"', categoria: "Manual", stockTotal: 8, stockDisponible: 8, stockDanado: 0 },
  { id: 3, codigo: "TL-003", nombre: "Amoladora angular", categoria: "Eléctrica", stockTotal: 3, stockDisponible: 3, stockDanado: 0 },
  { id: 4, codigo: "TL-004", nombre: "Martillo carpintero", categoria: "Manual", stockTotal: 10, stockDisponible: 10, stockDanado: 0 },
  { id: 5, codigo: "TL-005", nombre: "Juego de destornilladores", categoria: "Kit", stockTotal: 6, stockDisponible: 6, stockDanado: 0 },
];

const initialWorkers = [
  { id: 1, nombreCompleto: "Juan Pérez Soto", rut: "12.345.678-9", cargo: "Operador", area: "Mantención" },
  { id: 2, nombreCompleto: "María González Rojas", rut: "13.456.789-0", cargo: "Técnica", area: "Producción" },
  { id: 3, nombreCompleto: "Carlos Muñoz Díaz", rut: "14.567.890-1", cargo: "Supervisor", area: "Pañol" },
];

function normalizarHerramienta(tool) {
  const stockDanado = Number(tool.stockDanado ?? 0);
  const stockTotal = Number(tool.stockTotal ?? 0);
  const stockDisponible = Number(tool.stockDisponible ?? stockTotal - stockDanado);

  return {
    ...tool,
    stockTotal,
    stockDisponible,
    stockDanado,
  };
}

function leerStorage(key, fallback, normalizer = (value) => value) {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return fallback;
    return parsed.map(normalizer);
  } catch {
    return fallback;
  }
}

function guardarStorage(key, value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function formatDateTime(iso) {
  return new Date(iso).toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatearNombreTrabajador(trabajador) {
  return `${trabajador.nombreCompleto} · ${trabajador.cargo} · ${trabajador.area}`;
}

function construirLineasPrestamo(movimientosActivos) {
  if (!movimientosActivos.length) return ["No hay herramientas en préstamo actualmente."];

  return movimientosActivos.flatMap((m, index) => [
    `${index + 1}. Trabajador: ${m.trabajador}`,
    `Herramienta: ${m.herramientaNombre} (${m.codigo})`,
    `Cantidad pendiente: ${m.cantidadPendiente}`,
    `Fecha salida: ${formatDateTime(m.fechaSalida)}`,
    "",
  ]);
}

function renderTextoBadge(status) {
  if (status === "Devuelto") return "Devuelto";
  if (status === "Parcial") return "Devolución parcial";
  return "Prestado";
}

function validarRutChileno(rut) {
  const limpio = rut.replace(/\./g, "").replace(/-/g, "").toUpperCase();
  if (!/^\d{7,8}[\dK]$/.test(limpio)) return false;

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
    suma += Number(cuerpo[i]) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }

  const resto = 11 - (suma % 11);
  const esperado = resto === 11 ? "0" : resto === 10 ? "K" : String(resto);
  return esperado === dv;
}

function getToolAvailabilityStatus(tool) {
  if (tool.stockDisponible === 0 && tool.stockDanado > 0) return "Sin stock utilizable";
  if (tool.stockDisponible === 0) return "Agotado";
  if (tool.stockDanado > 0) return "Con unidades dañadas";
  if (tool.stockDisponible < tool.stockTotal) return "Parcialmente prestado";
  return "Disponible";
}

function ejecutarPruebas() {
  console.assert(construirLineasPrestamo([])[0] === "No hay herramientas en préstamo actualmente.", "Debe informar cuando no existan préstamos activos");
  console.assert(renderTextoBadge("Parcial") === "Devolución parcial", "Debe renderizar el texto del badge");
  console.assert(formatearNombreTrabajador({ nombreCompleto: "Ana", cargo: "Operaria", area: "Bodega" }) === "Ana · Operaria · Bodega", "Debe formatear trabajador");
  console.assert(validarRutChileno("12.345.678-5") === true, "Debe validar un RUT correcto");
  console.assert(validarRutChileno("12.345.678-9") === false, "Debe invalidar un RUT incorrecto");
  console.assert(normalizarHerramienta({ stockTotal: 3, stockDisponible: 2 }).stockDanado === 0, "Debe normalizar stock dañado");
}
if (typeof window !== "undefined") ejecutarPruebas();

function getEstadoColor(status) {
  if (status === "Devuelto") return "badge badge-ok";
  if (status === "Parcial") return "badge badge-warn";
  return "badge badge-danger";
}

function getConditionBadgeClass(condition) {
  if (condition === "Buena") return "badge badge-ok";
  if (condition === "Mala") return "badge badge-danger";
  return "badge badge-neutral";
}

function getInventoryBadgeClass(tool) {
  const status = getToolAvailabilityStatus(tool);
  if (status === "Disponible") return "badge badge-ok";
  if (status === "Parcialmente prestado" || status === "Con unidades dañadas") return "badge badge-warn";
  return "badge badge-danger";
}

function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatCard({ title, value, description, Icon }) {
  return (
    <div className="card stat-card">
      <div>
        <div className="muted small">{title}</div>
        <div className="stat-value">{value}</div>
        <div className="muted small">{description}</div>
      </div>
      <div className="stat-icon">
        <Icon size={24} />
      </div>
    </div>
  );
}

function FeedbackBanner({ feedback, onClose }) {
  if (!feedback) return null;

  const isError = feedback.type === "error";
  const Icon = isError ? XCircle : CheckCircle2;

  return (
    <div className={`feedback-banner ${isError ? "feedback-error" : "feedback-success"}`} role="status">
      <div className="feedback-content">
        <Icon size={18} />
        <span>{feedback.message}</span>
      </div>
      <button className="icon-btn feedback-close" onClick={onClose} aria-label="Cerrar mensaje">×</button>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState("movimientos");
  const [tools, setTools] = useState(() => leerStorage(STORAGE_KEYS.tools, initialTools, normalizarHerramienta));
  const [workers, setWorkers] = useState(() => leerStorage(STORAGE_KEYS.workers, initialWorkers));
  const [movimientos, setMovimientos] = useState(() => leerStorage(STORAGE_KEYS.movimientos, []));
  const [search, setSearch] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [openToolModal, setOpenToolModal] = useState(false);
  const [openWorkerModal, setOpenWorkerModal] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const [newTool, setNewTool] = useState({ codigo: "", nombre: "", categoria: "Manual", stockTotal: "1" });
  const [newWorker, setNewWorker] = useState({ nombreCompleto: "", rut: "", cargo: "", area: "" });
  const [salidaForm, setSalidaForm] = useState({ trabajadorId: "", herramientaId: "", cantidad: "1", motivo: "" });
  const [devolucionForm, setDevolucionForm] = useState({
    trabajadorId: "",
    movimientoId: "",
    cantidad: "1",
    estadoDevolucion: "Buena",
    observacionDevolucion: "",
  });

  useEffect(() => {
    guardarStorage(STORAGE_KEYS.tools, tools);
  }, [tools]);

  useEffect(() => {
    guardarStorage(STORAGE_KEYS.workers, workers);
  }, [workers]);

  useEffect(() => {
    guardarStorage(STORAGE_KEYS.movimientos, movimientos);
  }, [movimientos]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timeoutId = window.setTimeout(() => setFeedback(null), 3500);
    return () => window.clearTimeout(timeoutId);
  }, [feedback]);

  const filteredTools = useMemo(() => {
    const term = search.toLowerCase();
    return tools.filter(
      (tool) =>
        tool.nombre.toLowerCase().includes(term) ||
        tool.codigo.toLowerCase().includes(term) ||
        tool.categoria.toLowerCase().includes(term)
    );
  }, [tools, search]);

  const filteredMovimientos = useMemo(() => {
    const term = historySearch.toLowerCase();
    return movimientos.filter((movimiento) => {
      const bag = [
        movimiento.trabajador,
        movimiento.trabajadorRut,
        movimiento.herramientaNombre,
        movimiento.codigo,
        movimiento.estado,
        movimiento.estadoDevolucion ?? "",
        movimiento.observacionDevolucion ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return bag.includes(term);
    });
  }, [movimientos, historySearch]);

  const stats = useMemo(() => {
    const totalHerramientas = tools.reduce((acc, t) => acc + t.stockTotal, 0);
    const disponibles = tools.reduce((acc, t) => acc + t.stockDisponible, 0);
    const danadas = tools.reduce((acc, t) => acc + (t.stockDanado ?? 0), 0);
    const prestadas = totalHerramientas - disponibles - danadas;
    const enRiesgo = tools.filter((t) => t.stockDisponible === 0).length;
    return { totalHerramientas, disponibles, prestadas, enRiesgo, danadas };
  }, [tools]);

  const movimientosActivos = useMemo(
    () => movimientos.filter((m) => m.estado !== "Devuelto"),
    [movimientos]
  );

  const trabajadoresConPrestamoActivo = useMemo(
    () => workers.filter((worker) => movimientosActivos.some((m) => m.trabajadorId === worker.id)),
    [workers, movimientosActivos]
  );

  const prestamosActivosPorTrabajador = useMemo(() => {
    if (!devolucionForm.trabajadorId) return [];
    return movimientosActivos.filter((m) => String(m.trabajadorId) === devolucionForm.trabajadorId);
  }, [movimientosActivos, devolucionForm.trabajadorId]);

  const herramientaSeleccionadaSalida = useMemo(
    () => tools.find((tool) => String(tool.id) === salidaForm.herramientaId) ?? null,
    [tools, salidaForm.herramientaId]
  );

  const movimientoSeleccionadoDevolucion = useMemo(
    () => prestamosActivosPorTrabajador.find((m) => String(m.id) === devolucionForm.movimientoId) ?? null,
    [prestamosActivosPorTrabajador, devolucionForm.movimientoId]
  );

  const mostrarError = (message) => setFeedback({ type: "error", message });
  const mostrarExito = (message) => setFeedback({ type: "success", message });

  const exportarPrestamosPDF = async () => {
    setExportandoPdf(true);
    try {
      const doc = new jsPDF();
      let y = 18;

      const img = new Image();
      const imgLoaded = new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      img.src = LOGO_URL;
      try {
        await imgLoaded;
        doc.addImage(img, "PNG", 14, 8, 42, 16);
        y = 32;
      } catch {
        y = 18;
      }

      doc.setFontSize(16);
      doc.text("Reporte de herramientas en préstamo", 14, y);
      y += 8;

      doc.setFontSize(10);
      doc.text(`Fecha: ${new Date().toLocaleString("es-CL")}`, 14, y);
      y += 8;

      const lineas = construirLineasPrestamo(movimientosActivos);
      lineas.forEach((linea) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        if (linea) {
          doc.text(linea, 14, y);
          y += 6;
        } else {
          y += 4;
        }
      });

      doc.save("prestamos_panol.pdf");
      mostrarExito("Se generó el PDF de préstamos activos.");
    } finally {
      setExportandoPdf(false);
    }
  };

  const agregarHerramienta = (e) => {
    e.preventDefault();
    const stock = Number(newTool.stockTotal);
    const codigo = newTool.codigo.trim().toUpperCase();
    const nombre = newTool.nombre.trim();

    if (!codigo || !nombre || stock <= 0) {
      mostrarError("Completa el código, nombre y un stock válido para la herramienta.");
      return;
    }

    if (tools.some((tool) => tool.codigo.toLowerCase() === codigo.toLowerCase())) {
      mostrarError(`Ya existe una herramienta registrada con el código ${codigo}.`);
      return;
    }

    const nueva = {
      id: Date.now(),
      codigo,
      nombre,
      categoria: newTool.categoria,
      stockTotal: stock,
      stockDisponible: stock,
      stockDanado: 0,
    };

    setTools((prev) => [nueva, ...prev]);
    setNewTool({ codigo: "", nombre: "", categoria: "Manual", stockTotal: "1" });
    setOpenToolModal(false);
    mostrarExito(`Herramienta ${codigo} registrada correctamente.`);
  };

  const agregarTrabajador = (e) => {
    e.preventDefault();
    const nombreCompleto = newWorker.nombreCompleto.trim();
    const rut = newWorker.rut.trim();
    const cargo = newWorker.cargo.trim();
    const area = newWorker.area.trim();

    if (!nombreCompleto || !rut || !cargo || !area) {
      mostrarError("Completa todos los campos del trabajador para poder registrarlo.");
      return;
    }

    if (!validarRutChileno(rut)) {
      mostrarError("El RUT ingresado no es válido. Verifica formato y dígito verificador.");
      return;
    }

    if (workers.some((worker) => worker.rut.toLowerCase() === rut.toLowerCase())) {
      mostrarError(`Ya existe un trabajador registrado con el RUT ${rut}.`);
      return;
    }

    setWorkers((prev) => [
      { id: Date.now(), nombreCompleto, rut, cargo, area },
      ...prev,
    ]);
    setNewWorker({ nombreCompleto: "", rut: "", cargo: "", area: "" });
    setOpenWorkerModal(false);
    mostrarExito(`Trabajador ${nombreCompleto} registrado correctamente.`);
  };

  const registrarSalida = (e) => {
    e.preventDefault();
    const herramientaId = Number(salidaForm.herramientaId);
    const trabajadorId = Number(salidaForm.trabajadorId);
    const cantidad = Number(salidaForm.cantidad);
    const herramienta = tools.find((t) => t.id === herramientaId);
    const trabajador = workers.find((w) => w.id === trabajadorId);

    if (!trabajador || !herramienta) {
      mostrarError("Debes seleccionar un trabajador y una herramienta para registrar la salida.");
      return;
    }

    if (cantidad <= 0 || cantidad > herramienta.stockDisponible) {
      mostrarError("La cantidad solicitada supera el stock disponible de la herramienta.");
      return;
    }

    setTools((prev) =>
      prev.map((tool) =>
        tool.id === herramientaId ? { ...tool, stockDisponible: tool.stockDisponible - cantidad } : tool
      )
    );

    setMovimientos((prev) => [
      {
        id: Date.now(),
        trabajadorId,
        trabajador: trabajador.nombreCompleto,
        trabajadorRut: trabajador.rut,
        trabajadorCargo: trabajador.cargo,
        trabajadorArea: trabajador.area,
        herramientaId,
        herramientaNombre: herramienta.nombre,
        codigo: herramienta.codigo,
        cantidadSalida: cantidad,
        cantidadPendiente: cantidad,
        fechaSalida: new Date().toISOString(),
        fechaDevolucion: null,
        estado: "Prestado",
        estadoDevolucion: null,
        observacionDevolucion: null,
        motivo: salidaForm.motivo.trim() || "Sin detalle",
      },
      ...prev,
    ]);

    setSalidaForm({ trabajadorId: "", herramientaId: "", cantidad: "1", motivo: "" });
    mostrarExito(`Salida registrada para ${trabajador.nombreCompleto}.`);
  };

  const registrarDevolucion = (e) => {
    e.preventDefault();
    const movimientoId = Number(devolucionForm.movimientoId);
    const cantidad = Number(devolucionForm.cantidad);
    const movimiento = movimientos.find((m) => m.id === movimientoId);

    if (!devolucionForm.trabajadorId || !movimiento) {
      mostrarError("Selecciona el trabajador y la herramienta a devolver.");
      return;
    }

    if (cantidad <= 0 || cantidad > movimiento.cantidadPendiente) {
      mostrarError("La cantidad devuelta no puede superar lo pendiente del préstamo.");
      return;
    }

    if (String(movimiento.trabajadorId) !== devolucionForm.trabajadorId) {
      mostrarError("La herramienta seleccionada no corresponde al trabajador elegido.");
      return;
    }

    if (devolucionForm.estadoDevolucion === "Mala" && !devolucionForm.observacionDevolucion.trim()) {
      mostrarError("Debes describir el daño detectado para registrar una devolución mala.");
      return;
    }

    setTools((prev) =>
      prev.map((tool) => {
        if (tool.id !== movimiento.herramientaId) return tool;

        if (devolucionForm.estadoDevolucion === "Mala") {
          return { ...tool, stockDanado: (tool.stockDanado ?? 0) + cantidad };
        }

        return { ...tool, stockDisponible: tool.stockDisponible + cantidad };
      })
    );

    setMovimientos((prev) =>
      prev.map((m) => {
        if (m.id !== movimientoId) return m;
        const pendiente = m.cantidadPendiente - cantidad;
        return {
          ...m,
          cantidadPendiente: pendiente,
          fechaDevolucion: new Date().toISOString(),
          estado: pendiente === 0 ? "Devuelto" : "Parcial",
          estadoDevolucion: devolucionForm.estadoDevolucion,
          observacionDevolucion:
            devolucionForm.estadoDevolucion === "Mala"
              ? devolucionForm.observacionDevolucion.trim()
              : null,
        };
      })
    );

    setDevolucionForm({
      trabajadorId: "",
      movimientoId: "",
      cantidad: "1",
      estadoDevolucion: "Buena",
      observacionDevolucion: "",
    });
    mostrarExito(
      devolucionForm.estadoDevolucion === "Mala"
        ? "Devolución registrada y herramienta enviada a revisión por daño."
        : "Devolución registrada correctamente."
    );
  };

  return (
    <div className="page">
      <div className="container">
        <header className="topbar">
          <div>
            <h1>Control de salida de herramientas - Pañol</h1>
            <p className="muted">
              Registra préstamos, devoluciones e inventario disponible del pañol en una sola vista.
            </p>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-primary" onClick={() => setOpenToolModal(true)}>
              <Wrench size={16} />
              Agregar herramienta
            </button>
            <button className="btn btn-secondary" onClick={() => setOpenWorkerModal(true)}>
              <UserPlus size={16} />
              Agregar trabajador
            </button>
          </div>
        </header>

        <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />

        <section className="stats-grid">
          <StatCard title="Stock total" value={stats.totalHerramientas} description="Unidades registradas" Icon={Boxes} />
          <StatCard title="Disponibles" value={stats.disponibles} description="Listas para salir" Icon={Hammer} />
          <StatCard title="Prestadas" value={stats.prestadas} description="Actualmente fuera" Icon={ArrowUpRight} />
          <StatCard title="En revisión" value={stats.danadas} description="Con daño reportado" Icon={AlertTriangle} />
        </section>

        <div className="tabs">
          <div className="tab-list">
            {["movimientos", "inventario", "historial"].map((tab) => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "movimientos" && (
            <div className="section-stack">
              <div className="two-col">
                <div className="card">
                  <div className="card-header">
                    <h3><ArrowUpRight size={18} /> Formulario de salida</h3>
                    <p className="muted">Registra qué trabajador retira una herramienta del pañol.</p>
                  </div>
                  <form className="card-body form-grid" onSubmit={registrarSalida}>
                    <div>
                      <label>Nombre del trabajador</label>
                      <select
                        value={salidaForm.trabajadorId}
                        onChange={(e) => setSalidaForm({ ...salidaForm, trabajadorId: e.target.value })}
                      >
                        <option value="">Selecciona un trabajador registrado</option>
                        {workers.map((worker) => (
                          <option key={worker.id} value={worker.id}>{formatearNombreTrabajador(worker)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>Herramienta</label>
                      <select
                        value={salidaForm.herramientaId}
                        onChange={(e) => setSalidaForm({ ...salidaForm, herramientaId: e.target.value, cantidad: "1" })}
                      >
                        <option value="">Selecciona una herramienta</option>
                        {tools.map((tool) => (
                          <option key={tool.id} value={tool.id} disabled={tool.stockDisponible === 0}>
                            {tool.codigo} - {tool.nombre} ({tool.stockDisponible} disponibles{tool.stockDanado ? ` · ${tool.stockDanado} en revisión` : ""})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>Cantidad</label>
                      <input
                        type="number"
                        min="1"
                        max={herramientaSeleccionadaSalida?.stockDisponible ?? 1}
                        value={salidaForm.cantidad}
                        disabled={!herramientaSeleccionadaSalida}
                        onChange={(e) => {
                          const valor = Number(e.target.value);
                          const maximo = herramientaSeleccionadaSalida?.stockDisponible ?? 1;
                          if (!e.target.value) return setSalidaForm({ ...salidaForm, cantidad: "" });
                          if (valor < 1) return setSalidaForm({ ...salidaForm, cantidad: "1" });
                          setSalidaForm({ ...salidaForm, cantidad: String(Math.min(valor, maximo)) });
                        }}
                      />
                    </div>

                    <div>
                      <label>Motivo de uso</label>
                      <input
                        value={salidaForm.motivo}
                        onChange={(e) => setSalidaForm({ ...salidaForm, motivo: e.target.value })}
                        placeholder="Ej: Mantención línea 3"
                      />
                    </div>

                    <p className="muted small">
                      {herramientaSeleccionadaSalida
                        ? `Máximo disponible para salida: ${herramientaSeleccionadaSalida.stockDisponible}`
                        : "Selecciona una herramienta para habilitar la cantidad disponible."}
                    </p>

                    <button className="btn btn-primary full" type="submit">Registrar salida</button>
                  </form>
                </div>

                <div className="card">
                  <div className="card-header">
                    <h3><ArrowDownLeft size={18} /> Formulario de devolución</h3>
                    <p className="muted">Devuelve herramientas y actualiza automáticamente el inventario.</p>
                  </div>
                  <form className="card-body form-grid" onSubmit={registrarDevolucion}>
                    <div>
                      <label>Usuario con préstamo activo</label>
                      <select
                        value={devolucionForm.trabajadorId}
                        onChange={(e) => setDevolucionForm({ ...devolucionForm, trabajadorId: e.target.value, movimientoId: "" })}
                      >
                        <option value="">Selecciona un trabajador</option>
                        {trabajadoresConPrestamoActivo.map((worker) => (
                          <option key={worker.id} value={worker.id}>{worker.nombreCompleto}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>Herramienta a devolver</label>
                      <select
                        value={devolucionForm.movimientoId}
                        onChange={(e) => setDevolucionForm({ ...devolucionForm, movimientoId: e.target.value, cantidad: "1" })}
                      >
                        <option value="">Selecciona la herramienta</option>
                        {prestamosActivosPorTrabajador.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.herramientaNombre} ({m.codigo}) - {m.cantidadPendiente} pendiente
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>Cantidad devuelta</label>
                      <input
                        type="number"
                        min="1"
                        max={movimientoSeleccionadoDevolucion?.cantidadPendiente ?? 1}
                        value={devolucionForm.cantidad}
                        disabled={!movimientoSeleccionadoDevolucion}
                        onChange={(e) => {
                          const valor = Number(e.target.value);
                          const maximo = movimientoSeleccionadoDevolucion?.cantidadPendiente ?? 1;
                          if (!e.target.value) return setDevolucionForm({ ...devolucionForm, cantidad: "" });
                          if (valor < 1) return setDevolucionForm({ ...devolucionForm, cantidad: "1" });
                          setDevolucionForm({ ...devolucionForm, cantidad: String(Math.min(valor, maximo)) });
                        }}
                      />
                    </div>

                    <p className="muted small">
                      {movimientoSeleccionadoDevolucion
                        ? `Máximo a devolver: ${movimientoSeleccionadoDevolucion.cantidadPendiente}`
                        : "Selecciona una herramienta para habilitar la cantidad."}
                    </p>

                    <div>
                      <label>Estado de la devolución</label>
                      <select
                        value={devolucionForm.estadoDevolucion}
                        onChange={(e) =>
                          setDevolucionForm({
                            ...devolucionForm,
                            estadoDevolucion: e.target.value,
                            observacionDevolucion: e.target.value === "Mala" ? devolucionForm.observacionDevolucion : "",
                          })
                        }
                      >
                        <option value="Buena">Buena</option>
                        <option value="Mala">Mala</option>
                      </select>
                    </div>

                    {devolucionForm.estadoDevolucion === "Mala" && (
                      <div className="warning-box">
                        <label className="warning-label">
                          <TriangleAlert size={16} />
                          Observación de la devolución
                        </label>
                        <input
                          value={devolucionForm.observacionDevolucion}
                          onChange={(e) => setDevolucionForm({ ...devolucionForm, observacionDevolucion: e.target.value })}
                          placeholder="Ej: Herramienta con daño"
                        />
                        <p className="muted small">Describe el daño detectado. La unidad quedará en revisión y no volverá al stock disponible.</p>
                      </div>
                    )}

                    <button className="btn btn-secondary full" type="submit">Registrar devolución</button>
                  </form>
                </div>
              </div>

              <div className="card">
                <div className="card-header card-header-row">
                  <div>
                    <h3>Préstamos activos</h3>
                    <p className="muted">Herramientas que todavía no han sido devueltas por completo.</p>
                  </div>
                  <button className="btn btn-primary" onClick={exportarPrestamosPDF} disabled={exportandoPdf}>
                    <FileText size={16} />
                    {exportandoPdf ? "Generando PDF..." : "Exportar PDF"}
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Trabajador</th>
                        <th>Herramienta</th>
                        <th>Cantidad</th>
                        <th>Salida</th>
                        <th>Motivo</th>
                        <th>Estado</th>
                        <th>Condición devolución</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientosActivos.length === 0 ? (
                        <tr><td colSpan="8" className="center muted">No hay préstamos activos.</td></tr>
                      ) : (
                        movimientosActivos.map((m) => (
                          <tr key={m.id}>
                            <td><strong>{m.trabajador}</strong><div className="muted small">{m.trabajadorCargo} · {m.trabajadorArea}</div></td>
                            <td><strong>{m.herramientaNombre}</strong><div className="muted small">{m.codigo}</div></td>
                            <td>{m.cantidadPendiente}</td>
                            <td>{formatDateTime(m.fechaSalida)}</td>
                            <td>{m.motivo ?? "Sin detalle"}</td>
                            <td><span className={getEstadoColor(m.estado)}>{renderTextoBadge(m.estado)}</span></td>
                            <td>{m.estadoDevolucion ? <span className={getConditionBadgeClass(m.estadoDevolucion)}>{m.estadoDevolucion}</span> : "-"}</td>
                            <td>{m.observacionDevolucion ?? "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3><Users size={18} /> Trabajadores registrados</h3>
                  <p className="muted">Personal disponible para seleccionar en el formulario de salida.</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre completo</th>
                        <th>RUT</th>
                        <th>Cargo</th>
                        <th>Área</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workers.map((worker) => (
                        <tr key={worker.id}>
                          <td><strong>{worker.nombreCompleto}</strong></td>
                          <td>{worker.rut}</td>
                          <td>{worker.cargo}</td>
                          <td>{worker.area}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "inventario" && (
            <div className="card">
              <div className="card-header card-header-row">
                <div>
                  <h3><Wrench size={18} /> Inventario de herramientas</h3>
                  <p className="muted">Consulta existencias, disponibilidad y categorías del pañol.</p>
                </div>
                <div className="inline-summary muted small">
                  <span><Hammer size={14} /> Disponibles: {stats.disponibles}</span>
                  <span><AlertTriangle size={14} /> En revisión: {stats.danadas}</span>
                  <span><Boxes size={14} /> Sin disponibilidad: {stats.enRiesgo}</span>
                </div>
              </div>
              <div className="card-body">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    placeholder="Buscar por código, nombre o categoría"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Herramienta</th>
                        <th>Categoría</th>
                        <th>Stock total</th>
                        <th>Disponible</th>
                        <th>En revisión</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTools.map((tool) => (
                        <tr key={tool.id}>
                          <td><strong>{tool.codigo}</strong></td>
                          <td>{tool.nombre}</td>
                          <td>{tool.categoria}</td>
                          <td>{tool.stockTotal}</td>
                          <td>{tool.stockDisponible}</td>
                          <td>{tool.stockDanado}</td>
                          <td>
                            <span className={getInventoryBadgeClass(tool)}>{getToolAvailabilityStatus(tool)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === "historial" && (
            <div className="card">
              <div className="card-header">
                <h3>Historial de movimientos</h3>
                <p className="muted">Registro completo de salidas y devoluciones.</p>
              </div>
              <div className="card-body">
                <div className="search-box search-box-tight">
                  <Search size={16} />
                  <input
                    placeholder="Buscar por trabajador, RUT, herramienta o estado"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Trabajador</th>
                      <th>Herramienta</th>
                      <th>Salida</th>
                      <th>Devolución</th>
                      <th>Motivo</th>
                      <th>Pendiente</th>
                      <th>Estado</th>
                      <th>Condición devolución</th>
                      <th>Observación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovimientos.length === 0 ? (
                      <tr><td colSpan="9" className="center muted">No hay movimientos que coincidan con la búsqueda.</td></tr>
                    ) : (
                      filteredMovimientos.map((m) => (
                        <tr key={m.id}>
                          <td><strong>{m.trabajador}</strong><div className="muted small"><IdCard size={12} /> {m.trabajadorRut}</div></td>
                          <td><strong>{m.herramientaNombre}</strong><div className="muted small">{m.codigo}</div></td>
                          <td>{formatDateTime(m.fechaSalida)}</td>
                          <td>{m.fechaDevolucion ? formatDateTime(m.fechaDevolucion) : "-"}</td>
                          <td>{m.motivo ?? "Sin detalle"}</td>
                          <td>{m.cantidadPendiente}</td>
                          <td><span className={getEstadoColor(m.estado)}>{renderTextoBadge(m.estado)}</span></td>
                          <td>{m.estadoDevolucion ? <span className={getConditionBadgeClass(m.estadoDevolucion)}>{m.estadoDevolucion}</span> : "-"}</td>
                          <td>{m.observacionDevolucion ?? "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <Modal open={openToolModal} title="Nueva herramienta" onClose={() => setOpenToolModal(false)}>
          <form className="form-grid" onSubmit={agregarHerramienta}>
            <div>
              <label>Código</label>
              <input value={newTool.codigo} onChange={(e) => setNewTool({ ...newTool, codigo: e.target.value })} placeholder="Ej: TL-006" />
            </div>
            <div>
              <label>Nombre</label>
              <input value={newTool.nombre} onChange={(e) => setNewTool({ ...newTool, nombre: e.target.value })} placeholder="Ej: Sierra circular" />
            </div>
            <div>
              <label>Categoría</label>
              <select value={newTool.categoria} onChange={(e) => setNewTool({ ...newTool, categoria: e.target.value })}>
                <option value="Manual">Manual</option>
                <option value="Eléctrica">Eléctrica</option>
                <option value="Medición">Medición</option>
                <option value="Kit">Kit</option>
                <option value="Seguridad">Seguridad</option>
              </select>
            </div>
            <div>
              <label>Stock total</label>
              <input type="number" min="1" value={newTool.stockTotal} onChange={(e) => setNewTool({ ...newTool, stockTotal: e.target.value })} />
            </div>
            <button className="btn btn-primary full" type="submit">Guardar herramienta</button>
          </form>
        </Modal>

        <Modal open={openWorkerModal} title="Registrar trabajador" onClose={() => setOpenWorkerModal(false)}>
          <form className="form-grid" onSubmit={agregarTrabajador}>
            <div>
              <label>Nombre completo</label>
              <input value={newWorker.nombreCompleto} onChange={(e) => setNewWorker({ ...newWorker, nombreCompleto: e.target.value })} placeholder="Ej: Pedro Ramírez Soto" />
            </div>
            <div>
              <label>RUT</label>
              <input value={newWorker.rut} onChange={(e) => setNewWorker({ ...newWorker, rut: e.target.value })} placeholder="Ej: 12.345.678-5" />
            </div>
            <div>
              <label>Cargo</label>
              <input value={newWorker.cargo} onChange={(e) => setNewWorker({ ...newWorker, cargo: e.target.value })} placeholder="Ej: Operador" />
            </div>
            <div>
              <label>Área</label>
              <div className="input-with-icon">
                <Building2 size={16} />
                <input value={newWorker.area} onChange={(e) => setNewWorker({ ...newWorker, area: e.target.value })} placeholder="Ej: Mantención" />
              </div>
            </div>
            <button className="btn btn-primary full" type="submit">Guardar trabajador</button>
          </form>
        </Modal>
      </div>
    </div>
  );
}

export default App;
