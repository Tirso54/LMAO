"use client";

import { useRouter } from "next/navigation";
import { CHAMPION_LIST } from "@/game/engine/champions";

export default function LandingPage() {
  const router = useRouter();
  const go = (mode: string) => router.push(`/play?mode=${mode}`);

  return (
    <div className="landing">
      <header className="nav">
        <div className="logo">
          LMAO <small>LEAGUE OF MØØBAS</small>
        </div>
        <div className="nav-links">
          <a href="#como-se-juega">Cómo se juega</a>
          <a href="#campeones">Campeones</a>
          <button className="btn primary play-cta" onClick={() => go("solo")}>
            Jugar
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="badge-row">
          <span className="badge">Gratis</span>
          <span className="badge">Sin instalación</span>
          <span className="badge">Multijugador online</span>
          <span className="badge">Mapa abierto</span>
        </div>
        <h1>
          LMAO — <span className="accent">League of Mobass</span>
        </h1>
        <p className="tagline">
          Un MOBA para jugar directo en el navegador, ahora en un <b>mapa mucho más abierto</b>. Elige a tu
          campeón, sube de nivel con tus minions, flanquea por la hierba, derriba torretas y destruye el{" "}
          <b>Nexo</b> enemigo. Crea una sala y elige cuántos bots quieres en tu equipo y en el rival.
        </p>

        {/* Top-down preview of the new open arena. */}
        <div className="arena-preview" aria-hidden="true">
          <div className="ap-field">
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

        <div className="mode-row">
          <button className="btn primary play-cta" onClick={() => go("solo")}>
            Jugar ahora
          </button>
          <button className="btn blue play-cta" onClick={() => go("host")}>
            Crear sala
          </button>
          <button className="btn ghost play-cta" onClick={() => go("join")}>
            Unirse con código
          </button>
        </div>
      </section>

      <section className="section" id="como-se-juega">
        <h2 className="section-title">¿De qué trata el juego?</h2>
        <p className="section-sub">
          Cada partida es una batalla en una sola calle (estilo ARAM). Ambos equipos reciben oleadas de
          minions; los eliminas para conseguir oro y experiencia, subes de nivel tus habilidades, compras
          objetos y empujas hasta el corazón de la base enemiga. Gana el primer equipo que destruya el
          Nexo rival.
        </p>
        <div className="about-grid">
          <div className="about-card">
            <div className="ic">C</div>
            <h3>Controles de mando</h3>
            <p>
              En el juego tienes un joystick virtual estilo Brawl Stars en la esquina izquierda para moverte
              y botones de habilidad en la parte inferior. En PC también funcionan el ratón y el teclado.
            </p>
          </div>
          <div className="about-card">
            <div className="ic">B</div>
            <h3>Juega solo o con amigos</h3>
            <p>
              Pulsa <b>Jugar</b> para una partida rápida contra bots con un campeón asignado, o crea una sala
              y comparte el código para jugar con quien quieras.
            </p>
          </div>
          <div className="about-card">
            <div className="ic">F</div>
            <h3>Objetivo</h3>
            <p>
              Empuja tu calle con los minions, derriba las torretas enemigas y destruye su Nexo antes de que
              ellos destruyan el tuyo. Sin cuentas ni descargas.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="campeones">
        <h2 className="section-title">Campeones</h2>
        <p className="section-sub">
          Al pulsar <b>Jugar</b> se te asigna un campeón automáticamente con sus habilidades listas. Estos
          son los 8 personajes disponibles:
        </p>
        <div className="champ-grid">
          {CHAMPION_LIST.map((c) => (
            <div className="champ-tile" key={c.id} title={c.blurb}>
              <div className="glyph">{c.glyph}</div>
              <div className="name">{c.name}</div>
              <div className="role">{c.role}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Cómo se juega</h2>
        <div className="howto-list">
          <div className="howto-row">
            <span className="key">Mover</span>
            <p>Joystick táctil (izquierda) o clic derecho en PC. Ataca a los enemigos acercándote o tocándolos.</p>
          </div>
          <div className="howto-row">
            <span className="key">Habilidades</span>
            <p>Q, W, E y R lanzan tus habilidades. En táctil, toca el botón y se apuntan al enemigo más cercano.</p>
          </div>
          <div className="howto-row">
            <span className="key">Subir nivel</span>
            <p>Consigue experiencia con minions y bajas. Pulsa el <b>+</b> sobre una habilidad (o Ctrl+Q/W/E/R) para mejorarla.</p>
          </div>
          <div className="howto-row">
            <span className="key">Ganar</span>
            <p>Destruye las torretas enemigas y luego su Nexo. Tu equipo comparte la victoria.</p>
          </div>
        </div>
      </section>

      <footer className="footer">
        LMAO — League of Mobass es un juego de parodia, sin afiliación ni respaldo de ningún juego real.
        Cualquier parecido con campeones vivos o muertos es pura coincidencia. Construido con Next.js,
        React y WebRTC (PeerJS). Sin tiendas, sin cuentas, sin necesidad de instalar nada.
        <br />
        © {new Date().getFullYear()} LMAO. Juega gratis desde tu navegador.
      </footer>
    </div>
  );
}
