"use client";

import { useRouter } from "next/navigation";
import { CHAMPION_LIST } from "@/game/engine/champions";

/** Small filled/empty star meter (difficulty 1..3). */
function Stars({ value, max = 3 }: { value: number; max?: number }) {
  return (
    <span className="stars" aria-label={`${value} de ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < value ? "" : "off"}>
          ★
        </span>
      ))}
    </span>
  );
}

const ROLE_ES: Record<string, string> = {
  Fighter: "Luchador",
  Marksman: "Tirador",
  Mage: "Mago",
  Tank: "Tanque",
  Assassin: "Asesino",
  Support: "Support",
};

export default function LandingPage() {
  const router = useRouter();
  const go = (mode: string) => router.push(`/play?mode=${mode}`);

  return (
    <div className="landing">
      {/* -------------------------------------------------- Nav */}
      <header className="nav">
        <div className="brand">
          <span className="mark wordmark">LMAO</span>
          <span className="tag-chip">EDICIÓN OFF-BRAND</span>
        </div>
        <nav className="nav-links">
          <a href="#campeones">Campeones</a>
          <a href="#como-funciona">Cómo se juega</a>
          <a href="#notas">Notas del parche</a>
          <button className="btn primary" onClick={() => go("solo")}>
            Jugar gratis
          </button>
        </nav>
      </header>

      {/* -------------------------------------------------- Hero */}
      <section className="hero">
        <div className="feature-pills">
          <span className="pill">Gratis</span>
          <span className="pill">Sin instalación</span>
          <span className="pill">Multijugador online</span>
          <span className="pill plain">Campo abierto</span>
        </div>

        <h1 className="wordmark">LMAO</h1>
        <div className="subtitle">League of Møøbas</div>
        <div className="from">
          El MOBA <b>legalmente distinto</b> — hecho en un navegador, no en un estudio
        </div>

        <p className="tagline">
          Un MOBA <b>cinematográfico</b> que corre entero en tu navegador. Elige a tu campeón,
          sube de nivel con tus minions, flanquea por la <span className="accent">hierba</span>,
          derriba torretas y destruye el <b>Nexo</b> enemigo. Crea una sala y decide cuántos
          bots quieres en tu equipo… y cuántos sufrirán en el rival.
        </p>

        <div className="cta-row">
          <button className="btn primary lg" onClick={() => go("solo")}>
            ▷ Jugar ahora
          </button>
          <button className="btn gold-outline lg" onClick={() => go("host")}>
            Crear sala
          </button>
          <button className="btn ghost lg" onClick={() => go("join")}>
            Unirse con código
          </button>
        </div>
        <div className="microcopy">
          Sin descargas · Sin cuentas · Sin reembolsos (no hay nada que reembolsar)
        </div>

        {/* Animated top-down preview of the arena */}
        <div className="arena-preview" aria-hidden="true">
          <div className="ap-field">
            <div className="ap-grid" />
            <div className="ap-base blue">
              <span className="ap-nexus" />
            </div>
            <div className="ap-road" />
            <div className="ap-base red">
              <span className="ap-nexus" />
            </div>
            <span className="ap-bush" style={{ top: "18%", left: "34%" }} />
            <span className="ap-bush" style={{ top: "70%", left: "44%" }} />
            <span className="ap-bush" style={{ top: "30%", left: "62%" }} />
            <span className="ap-bush" style={{ top: "62%", left: "24%" }} />
            <span className="ap-bush" style={{ top: "24%", left: "50%" }} />
            <span className="ap-champ blue" style={{ top: "48%", left: "30%" }} />
            <span className="ap-champ red" style={{ top: "52%", left: "66%" }} />
            <span className="ap-champ red" style={{ top: "38%", left: "58%" }} />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Battleground */}
      <section className="section" id="campo">
        <div className="section-head">
          <p className="eyebrow">Un solo campo, cero piedad</p>
          <h2 className="section-title">El Barranco del Alboroto</h2>
          <p className="section-sub">
            Un campo cuadrado enorme con tres calles — superior, media e inferior — que rodean
            la jungla: doce torretas por bando, campamentos que pican, pozos de Barón y Draggón,
            y hierba por todas partes para flanquear. Ganáis quien reviente el Nexo enemigo primero.
          </p>
          <div className="rule" />
        </div>

        <div className="map-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="map-card gold">
            <span className="flag pill">El original</span>
            <div className="map-icon">🗺️</div>
            <h3>El Barranco del Alboroto</h3>
            <div className="meta">3 calles · 24 torretas · jungla · 1–5 por equipo</div>
            <p>
              Empuja tu calle con las oleadas, escóndete en la hierba para tender emboscadas,
              limpia los campamentos y derriba torreta a torreta —exterior, interior e inhibidora—
              hasta abrir la base y partir el Nexo en dos. Bots opcionales para rellenar los huecos: pueden ir despistados o con
              demasiada cafeína.
            </p>
            <div className="tags">
              <span className="pill plain">Hierba para flanquear</span>
              <span className="pill plain">Campamentos de jungla</span>
              <span className="pill plain">Torretas + Nexo</span>
              <span className="pill plain">Bots regulables</span>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Champions */}
      <section className="section" id="campeones">
        <div className="section-head">
          <p className="eyebrow">{CHAMPION_LIST.length} campeones legalmente distintos</p>
          <h2 className="section-title">Elige tu bootleg</h2>
          <p className="section-sub">
            Cada uno con pasiva y habilidades Q/W/E/R propias: skillshots, dashes, ganchos, ultis
            globales, ejecuciones y trampas. Al pulsar <b>Jugar</b> eliges el tuyo en la selección
            de campeón.
          </p>
          <div className="rule" />
        </div>

        <div className="champ-grid">
          {CHAMPION_LIST.map((c) => (
            <div
              className="champ-card"
              key={c.id}
              style={{ ["--card-color" as any]: `${c.color}66` }}
            >
              <div className="top">
                <div
                  className="champ-portrait"
                  style={{ background: `linear-gradient(150deg, ${c.color}, ${c.color}99)` }}
                >
                  {c.glyph}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="name">{c.name}</div>
                  <div className="title">{c.title}</div>
                </div>
              </div>
              <p className="blurb">{c.blurb}</p>
              <div className="role-row">
                <span className="role">{ROLE_ES[c.role] || c.role}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="pill plain" style={{ fontSize: 11, padding: "3px 9px" }}>
                    ★ {c.rating.toFixed(1)}
                  </span>
                  <Stars value={c.difficulty} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------- How it works */}
      <section className="section" id="como-funciona">
        <div className="section-head">
          <p className="eyebrow">Cómo funciona</p>
          <h2 className="section-title">Es básicamente el juego real, con un 97% de descuento</h2>
          <p className="section-sub">
            Cada partida es una batalla por una calle. Ambos equipos reciben oleadas de minions;
            los rematas para conseguir oro y experiencia, subes tus habilidades, compras objetos y
            empujas hasta el Nexo rival.
          </p>
          <div className="rule" />
        </div>

        <div className="feature-grid" style={{ marginBottom: 16 }}>
          <div className="feature-card">
            <div className="fic">◑</div>
            <h3>Controles de mando</h3>
            <p>
              Joystick virtual estilo Brawl Stars a la izquierda para moverte y botones de
              habilidad abajo. En PC también van <b>ratón y teclado</b>.
            </p>
          </div>
          <div className="feature-card">
            <div className="fic">⚔</div>
            <h3>Solo o con amigos</h3>
            <p>
              Pulsa <b>Jugar</b> para una partida rápida contra bots, o crea una sala y comparte el
              código de 5 letras. Los huecos vacíos se rellenan con bots.
            </p>
          </div>
          <div className="feature-card">
            <div className="fic">◎</div>
            <h3>El objetivo</h3>
            <p>
              Empuja con tus minions, tira las torretas enemigas y destruye su <b>Nexo</b> antes de
              que ellos revienten el tuyo. Sin cuentas, sin descargas.
            </p>
          </div>
        </div>

        <div className="howto-list">
          <div className="howto-row">
            <span className="key">Mover</span>
            <p>Joystick táctil (izquierda) o <b>clic derecho</b> en PC. Ataca acercándote.</p>
          </div>
          <div className="howto-row">
            <span className="key">Q W E R</span>
            <p>Lanza tus habilidades. En táctil apuntan al enemigo más cercano.</p>
          </div>
          <div className="howto-row">
            <span className="key">Subir</span>
            <p>Gana XP con minions y bajas. Pulsa <b>＋</b> (o Ctrl+Q/W/E/R) para mejorar.</p>
          </div>
          <div className="howto-row">
            <span className="key">Ganar</span>
            <p>Torretas primero, luego el <b>Nexo</b>. Tu equipo comparte la victoria.</p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Patch notes */}
      <section className="section tight" id="notas">
        <div className="patch">
          <div className="ver">v1.0</div>
          <div className="body">
            <h3>Notas del parche — «Todo a un euro»</h3>
            <ul>
              <li><b>Campo más abierto:</b> más hierba y campamentos de jungla para flanquear.</li>
              <li><b>Respawn de 5s</b> y efectos de disparo más visibles.</li>
              <li><b>Selección de campeón</b> al entrar, con campeón asignado a cada bot.</li>
              <li>Se equilibró a Garón. Sigue girando. No sabemos cómo pararlo.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- CTA */}
      <section className="section tight">
        <div className="cta-banner">
          <h2>¿Listo para perder con estilo?</h2>
          <p>Sin instalar nada. Sin crear cuentas. Solo tú, tus bots y un Nexo que reventar.</p>
          <div className="cta-row">
            <button className="btn primary lg" onClick={() => go("solo")}>
              ▷ Jugar ahora
            </button>
            <button className="btn gold-outline lg" onClick={() => go("host")}>
              Crear sala
            </button>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- Footer */}
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <div className="brand-mark">LMAO</div>
            <div style={{ color: "var(--ink-faint)", fontSize: 12, marginTop: 6 }}>
              League of Møøbas · Edición Off-brand
            </div>
          </div>
          <p className="fine">
            LMAO — League of Møøbas es un juego de parodia, sin afiliación ni respaldo de ningún
            juego real. Cualquier parecido con campeones vivos o muertos es pura coincidencia que
            negaremos ante un juez. Construido con Next.js, React y WebRTC (PeerJS). Sin tiendas,
            sin cuentas, sin necesidad de instalar nada.
            <br />
            <br />© {new Date().getFullYear()} LMAO. Juega gratis desde tu navegador.
          </p>
        </div>
      </footer>
    </div>
  );
}
