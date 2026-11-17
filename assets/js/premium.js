/* ==========================================================================
   PANGEA, maquette gastronomique : animations
   GSAP + ScrollTrigger (mouvements) et Lenis (défilement amorti), en local.

   Deux régimes :
   - complet : mouvements, défilement amorti, section épinglée ;
   - doux (si le système demande de réduire les animations) : on garde les
     fondus et les tracés, on retire les grands déplacements. Le site reste vivant
     sans gêner les personnes sensibles au mouvement.
   ========================================================================== */
(() => {
  /* Adresse de l'application Web Google Apps Script qui enregistre les réservations
     (voir reservation/LISEZMOI.md). Vide = mode démonstration : rien n'est envoyé. */
  const RESERVATION_URL = "https://script.google.com/macros/s/AKfycbwliaem3fhQZIi-FUIo171zoa-9gjZtFygpIcj_5xOSK5UlPc8YLeZ_YqI5_w6enV4X/exec";
  const racine = document.documentElement;
  const doux = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const souris = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const k = doux ? 0 : 1; // multiplicateur des déplacements

  /* ---------- Menu mobile et en-tête (fonctionnent sans GSAP) ---------- */
  const entete = document.querySelector(".entete");
  const burger = document.querySelector(".burger");
  const tiroir = document.getElementById("tiroir");
  let lenis = null;
  const basculer = (ouvrir) => {
    burger.setAttribute("aria-expanded", String(ouvrir));
    burger.setAttribute("aria-label", ouvrir ? "Fermer le menu" : "Ouvrir le menu");
    const mot = burger.querySelector(".burger-texte"); if (mot) mot.textContent = ouvrir ? "Fermer" : "Menu";
    tiroir.classList.toggle("ouvert", ouvrir);
    document.body.classList.toggle("tiroir-ouvert", ouvrir);
    if (lenis) ouvrir ? lenis.stop() : lenis.start();
  };
  burger.addEventListener("click", () => basculer(burger.getAttribute("aria-expanded") !== "true"));
  tiroir.querySelectorAll("a, [data-reserver]").forEach((a) => a.addEventListener("click", () => basculer(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && tiroir.classList.contains("ouvert")) basculer(false); });
  const surDefilement = () => entete.classList.toggle("defile", scrollY > 60);
  addEventListener("scroll", surDefilement, { passive: true });
  surDefilement();

  const G = window.gsap, ST = window.ScrollTrigger;
  if (!G || !ST) { racine.classList.remove("avec-intro"); return; }
  G.registerPlugin(ST);
  racine.classList.add("anime");
  if (doux) racine.classList.add("doux");

  /* ---------- Défilement amorti ---------- */
  if (!doux && window.Lenis) {
    lenis = new Lenis({ duration: 1.25, easing: (t) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    lenis.on("scroll", ST.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const cible = document.querySelector(a.getAttribute("href"));
    if (!cible) return;
    e.preventDefault();
    const decalage = a.getAttribute("href") === "#haut" ? 0 : -40;
    if (lenis) lenis.scrollTo(cible, { offset: decalage, duration: 1.8 });
    else scrollTo({ top: cible.getBoundingClientRect().top + scrollY + decalage, behavior: doux ? "auto" : "smooth" });
  }));

  /* ---------- Barre de progression dorée ---------- */
  G.fromTo(".progression", { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

  /* ---------- Découpe du texte (lettres ou mots), lisible par les lecteurs d'écran ---------- */
  const decouper = (el, mode) => {
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    const traiter = (noeud) => {
      [...noeud.childNodes].forEach((n) => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((mot) => {
            if (!mot) return;
            if (/^\s+$/.test(mot)) { frag.append(" "); return; }
            const m = document.createElement("span");
            m.className = "mot"; m.setAttribute("aria-hidden", "true");
            if (mode === "lettres") {
              [...mot].forEach((c) => { const s = document.createElement("span"); s.className = "car"; s.textContent = c; m.append(s); });
            } else m.textContent = mot;
            frag.append(m);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) traiter(n);
      });
    };
    traiter(el);
  };
  document.querySelectorAll("[data-lettres]").forEach((el) => decouper(el, "lettres"));
  document.querySelectorAll("[data-mots]").forEach((el) => decouper(el, "mots"));

  /* ---------- Formes terracotta de l'ouverture : elles respirent lentement ---------- */
  if (!doux) {
    G.to(".forme--a", { rotate: 25, scale: 1.08, duration: 14, ease: "sine.inOut", yoyo: true, repeat: -1 });
    G.to(".forme--b", { xPercent: 12, yPercent: -10, scale: 1.12, duration: 11, ease: "sine.inOut", yoyo: true, repeat: -1 });
    G.to(".ouverture-formes", { yPercent: 18, ease: "none", scrollTrigger: { trigger: ".ouverture", start: "top top", end: "bottom top", scrub: true } });
  }

  /* ---------- Lueurs de bougie ---------- */
  document.querySelectorAll(".ouverture .lueur").forEach((l, i) => {
    if (!doux) {
      const derive = () => G.to(l, {
        xPercent: G.utils.random(-18, 18), yPercent: G.utils.random(-14, 14), scale: G.utils.random(0.85, 1.2),
        duration: G.utils.random(6, 10), ease: "sine.inOut", onComplete: derive,
      });
      derive();
    }
    G.to(l, { opacity: G.utils.random(0.5, 0.9), duration: G.utils.random(1.6, 2.8), ease: "sine.inOut", yoyo: true, repeat: -1, delay: i * 0.4 });
  });

  /* ---------- Ouverture ---------- */
  const titre = document.querySelector(".ouverture-titre");
  const ouverture = G.timeline({ paused: true, defaults: { ease: "expo.out" } })
    .from(titre.querySelectorAll(".car"), { yPercent: 115 * k, opacity: doux ? 0 : 1, rotate: 7 * k, duration: 1.6, stagger: { each: 0.035, from: "start" } }, 0)
    .from(".filet-or", { scaleX: 0, duration: 1.6, ease: "power3.inOut" }, "-=1.1")
    .from(".ouverture-chapo", { opacity: 0, y: 18 * k, duration: 1.4 }, "-=1")
    .from(".ouverture .bouton", { opacity: 0, y: 18 * k, duration: 1.4 }, "-=1.15")
    .from(".ouverture-note", { opacity: 0, letterSpacing: doux ? "0.28em" : "0.6em", duration: 2, ease: "power3.out" }, "-=1.3")
    .from(".entete", { opacity: 0, y: -20 * k, duration: 1.4 }, "-=1.8");

  if (racine.classList.contains("avec-intro")) {
    try { sessionStorage.setItem("pangea-intro", "1"); } catch (e) {}
    const intro = G.timeline({ onComplete: () => racine.classList.remove("avec-intro") })
      .from(".intro-sceau", { scale: doux ? 1 : 0.6, opacity: 0, rotate: -12 * k, duration: 1.1, ease: "back.out(1.6)" })
      .to(".intro-sceau", { scale: doux ? 1 : 0.9, opacity: 0, duration: 0.6, ease: "power2.in" }, "+=0.35");
    if (doux) intro.to(".intro", { opacity: 0, duration: 0.9 }, "-=0.1");
    else intro.to(".intro-moitie--haut", { yPercent: -100, duration: 1.2, ease: "expo.inOut" }, "-=0.15")
              .to(".intro-moitie--bas", { yPercent: 100, duration: 1.2, ease: "expo.inOut" }, "<");
    intro.add(() => ouverture.play(), "-=0.7");
  } else ouverture.play();

  if (!doux) {
    /* En quittant l'ouverture : le titre recule */
    G.to(".ouverture-contenu", { yPercent: -18, scale: 0.94, opacity: 0, ease: "none", scrollTrigger: { trigger: ".ouverture", start: "top top", end: "bottom top", scrub: true } });
    /* La lueur principale suit la souris */
    const halo = document.querySelector(".ouverture .lueur--1");
    if (souris && halo) {
      const hx = G.quickTo(halo, "x", { duration: 2.4, ease: "power3.out" });
      const hy = G.quickTo(halo, "y", { duration: 2.4, ease: "power3.out" });
      document.querySelector(".ouverture").addEventListener("pointermove", (e) => { hx((e.clientX - innerWidth / 2) * 0.35); hy((e.clientY - innerHeight / 2) * 0.35); });
    }
  }

  /* ---------- La maison : les mots s'allument à mesure qu'on lit ---------- */
  G.from(".monogramme", { scale: doux ? 1 : 0.5, rotate: -20 * k, opacity: 0, duration: 1.4, ease: "back.out(1.7)", scrollTrigger: { trigger: ".maison", start: "top 70%" } });
  G.fromTo(".maison-texte .mot", { opacity: 0.12 }, {
    opacity: 1, stagger: 0.08, ease: "none",
    scrollTrigger: { trigger: ".maison-texte", start: "top 80%", end: "bottom 45%", scrub: 0.6 },
  });
  G.from(".maison-signature", { opacity: 0, letterSpacing: doux ? "0.28em" : "0.7em", duration: 2, ease: "power3.out", scrollTrigger: { trigger: ".maison-signature", start: "top 90%" } });

  /* ---------- La carte : les trois cartons se posent, la couleur monte, la signature s'écrit ---------- */
  G.timeline({ scrollTrigger: { trigger: ".services", start: "top 78%" }, defaults: { ease: "expo.out" } })
    .from(".service", { y: 90 * k, rotateX: 14 * k, rotate: (i) => (i - 1) * 3 * k, opacity: 0, duration: 1.6, stagger: 0.14 })
    .from(".service-fond", { clipPath: "inset(100% 0% 0% 0%)", duration: 1.4, ease: "power4.inOut", stagger: 0.14 }, 0.25)
    .from(".service-num", { yPercent: 40 * k, opacity: 0, duration: 1.5, stagger: 0.14 }, 0.7)
    .fromTo(".service-signature", { clipPath: "inset(-30% 100% -30% 0%)" }, { clipPath: "inset(-30% -5% -30% 0%)", duration: 1.6, ease: "power2.inOut", stagger: 0.14 }, 1)
    .from(".service-papier > *", { y: 14 * k, opacity: 0, duration: 1.1, stagger: 0.04 }, 1.1);
  G.from(".carte-note", { opacity: 0, y: 14 * k, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: ".carte-note", start: "top 95%" } });
  // Le chiffre suit doucement la souris dans son aplat
  if (souris && !doux) document.querySelectorAll(".service").forEach((s) => {
    const n = s.querySelector(".service-num");
    const nx = G.quickTo(n, "x", { duration: 1.2, ease: "power3.out" }), ny = G.quickTo(n, "y", { duration: 1.2, ease: "power3.out" });
    s.addEventListener("pointermove", (e) => { const b = s.getBoundingClientRect(); nx(((e.clientX - b.left) / b.width - 0.5) * 18); ny(((e.clientY - b.top) / b.height - 0.5) * 12); });
    s.addEventListener("pointerleave", () => { nx(0); ny(0); });
  });

  /* ---------- Interlude : deux lignes qui se rejoignent ---------- */
  if (!doux) {
    G.timeline({ scrollTrigger: { trigger: ".interlude", start: "top top", end: "+=120%", scrub: 0.8, pin: ".interlude-scene" } })
      .fromTo(".interlude-ligne--1", { xPercent: -60, opacity: 0.15 }, { xPercent: 0, opacity: 1, ease: "power2.out" }, 0)
      .fromTo(".interlude-ligne--2", { xPercent: 60, opacity: 0.15 }, { xPercent: 0, opacity: 1, ease: "power2.out" }, 0)
      .fromTo(".forme--1", { xPercent: -30, yPercent: -20 }, { xPercent: 10, yPercent: 10, ease: "none" }, 0)
      .fromTo(".forme--2", { xPercent: 30, yPercent: 20 }, { xPercent: -10, yPercent: -10, ease: "none" }, 0)
      .fromTo(".forme--3", { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, ease: "none" }, 0);
  } else {
    G.from(".interlude-ligne", { opacity: 0, duration: 1.8, stagger: 0.5, scrollTrigger: { trigger: ".interlude", start: "top 60%" } });
  }

  /* ---------- Titres de section : lettres qui montent ---------- */
  document.querySelectorAll(".titre-section").forEach((t) => {
    G.from(t.querySelectorAll(".car"), {
      yPercent: 110 * k, opacity: 0, duration: 1.3, stagger: 0.022, ease: "expo.out",
      scrollTrigger: { trigger: t, start: "top 85%" },
    });
  });

  /* ---------- La démarche ---------- */
  G.from(".pilier", {
    y: 50 * k, opacity: 0, duration: 1.5, stagger: 0.18, ease: "expo.out",
    scrollTrigger: { trigger: ".piliers", start: "top 82%", onEnter: () => document.querySelector(".piliers").classList.add("ouvert") },
  });

  /* ---------- L'équipe : les portraits se dévoilent de bas en haut ---------- */
  document.querySelectorAll(".membre").forEach((m, i) => {
    G.timeline({ scrollTrigger: { trigger: ".bureau", start: "top 80%" }, defaults: { ease: "expo.out" }, delay: i * 0.12 })
      .from(m.querySelector(".portrait"), { clipPath: "inset(100% 0% 0% 0%)", duration: 1.6, ease: "power4.inOut" })
      .from(m.querySelector(".portrait > *"), { scale: doux ? 1 : 1.25, duration: 2 }, 0)
      .from(m.querySelectorAll(".membre-role, .membre-nom, .membre-note"), { y: 14 * k, opacity: 0, duration: 1.1, stagger: 0.08 }, 0.7);
  });
  G.from(".equipe-chapo, .equipe-objet", { opacity: 0, y: 20 * k, duration: 1.4, ease: "expo.out", stagger: 0.2, scrollTrigger: { trigger: ".equipe-chapo", start: "top 88%" } });

  /* ---------- Engagements : les lignes s'inscrivent une à une ---------- */
  document.querySelectorAll(".engagements-colonne").forEach((col) => {
    G.from(col.querySelectorAll(".surtitre, dl > div"), { opacity: 0, x: -24 * k, duration: 1.2, stagger: 0.09, ease: "expo.out", scrollTrigger: { trigger: col, start: "top 80%" } });
  });

  /* ---------- Calendrier : le fil se remplit au défilement ---------- */
  const fil = document.querySelector(".etapes");
  if (fil) {
    G.to(fil, { "--avance": 1, ease: "none", scrollTrigger: { trigger: fil, start: "top 70%", end: "bottom 60%", scrub: 0.6 } });
    fil.querySelectorAll(".etape").forEach((e) => {
      G.from(e.querySelectorAll(".etape-quand, .etape-titre, .etape-texte, .etape-numero"), { opacity: 0, y: 16 * k, duration: 1.1, stagger: 0.07, ease: "expo.out", scrollTrigger: { trigger: e, start: "top 82%" } });
    });
  }

  /* ---------- Questions : ouverture en douceur ---------- */
  document.querySelectorAll(".faq-item").forEach((d) => {
    const sommaire = d.querySelector("summary"), rep = d.querySelector(".faq-reponse");
    sommaire.addEventListener("click", (e) => {
      e.preventDefault();
      if (d.open) {
        G.to(rep, { height: 0, opacity: 0, duration: 0.6, ease: "power3.inOut", onComplete: () => { d.open = false; G.set(rep, { clearProps: "height,opacity" }); } });
      } else {
        d.open = true;
        G.from(rep, { height: 0, opacity: 0, duration: 0.8, ease: "expo.out" });
      }
    });
  });
  G.from(".faq-item", { opacity: 0, y: 20 * k, duration: 1.1, stagger: 0.06, ease: "expo.out", scrollTrigger: { trigger: ".faq", start: "top 85%" } });

  /* ---------- Demande de réservation : un carton qui s'ouvre, puis l'e-mail préparé ---------- */
  const dlg = document.getElementById("reservation");
  if (dlg) {
    const form = dlg.querySelector("form"), sortie = form.querySelector("output"), erreur = form.querySelector(".reservation-erreur");
    let couverts = 2;
    const majCouverts = (n) => { couverts = Math.min(10, Math.max(1, n)); sortie.value = couverts; sortie.textContent = couverts; };
    form.addEventListener("input", (e) => { if (e.target.checkValidity()) e.target.setAttribute("aria-invalid", "false"); if (!form.querySelector('[aria-invalid="true"]')) erreur.hidden = true; });
    form.querySelector("[data-moins]").addEventListener("click", () => majCouverts(couverts - 1));
    form.querySelector("[data-plus]").addEventListener("click", () => majCouverts(couverts + 1));
    const ouvrir = () => {
      form.classList.remove("envoye"); form.querySelector(".reservation-merci").hidden = true; erreur.hidden = true;
      if (lenis) lenis.stop();
      dlg.showModal();
      const places = form.querySelector(".reservation-places");
      if (RESERVATION_URL) fetch(RESERVATION_URL).then((r) => r.json()).then((rep) => {
        if (rep.ok && typeof rep.restantes === "number") { places.querySelector("span").textContent = rep.restantes; places.hidden = false; }
      }).catch(() => {});
      G.fromTo(form, { y: 40 * k, rotateX: 10 * k, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 0.9, ease: "expo.out" });
      G.from(form.querySelectorAll(".surtitre, .reservation-titre, .reservation-chapo, .champ, .accord, .reservation-actions"), { y: 12 * k, opacity: 0, duration: 0.8, stagger: 0.04, delay: 0.15, ease: "expo.out" });
    };
    const fermer = () => G.to(form, { y: 30 * k, opacity: 0, duration: 0.45, ease: "power2.in", onComplete: () => { dlg.close(); G.set(form, { clearProps: "all" }); } });
    dlg.addEventListener("close", () => { if (lenis) lenis.start(); });
    document.querySelectorAll("[data-reserver]").forEach((b) => b.addEventListener("click", ouvrir));
    dlg.querySelectorAll("[data-fermer]").forEach((b) => b.addEventListener("click", fermer));
    dlg.addEventListener("click", (e) => { if (e.target === dlg) fermer(); });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); fermer(); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const champs = [...form.querySelectorAll("input[required]")];
      champs.forEach((c) => c.setAttribute("aria-invalid", c.checkValidity() ? "false" : "true"));
      const manquant = champs.find((c) => !c.checkValidity());
      if (manquant) {
        erreur.textContent = manquant.type === "checkbox" ? "Merci de cocher la case de confirmation." : manquant.type === "email" && manquant.value ? "L’adresse e-mail ne semble pas valide." : "Merci de remplir tous les champs obligatoires.";
        erreur.hidden = false; manquant.focus(); return;
      }
      const d = new FormData(form);
      d.set("couverts", couverts);
      const bouton = form.querySelector("[type=submit]"), libelle = bouton.textContent;
      const merci = (statut) => {
        form.querySelector(".reservation-merci-texte").textContent = statut === "Liste d'attente"
          ? "Toutes les places sont réservées pour le moment : votre demande est inscrite sur liste d’attente. Nous vous écrivons dès qu’une table se libère."
          : "Votre demande est bien enregistrée. Un accusé de réception vient de partir vers votre boîte mail ; nous revenons vers vous très vite pour confirmer votre table.";
        form.classList.add("envoye"); form.querySelector(".reservation-merci").hidden = false;
        G.from(form.querySelector(".reservation-merci"), { y: 14 * k, opacity: 0, duration: 0.8, ease: "expo.out" });
      };
      if (!RESERVATION_URL) { console.info("Réservation : mode démonstration (RESERVATION_URL vide), rien n'est enregistré."); merci("Reçue"); return; }
      bouton.disabled = true; bouton.textContent = "Envoi en cours…";
      fetch(RESERVATION_URL, { method: "POST", body: new URLSearchParams(d) })
        .then((r) => r.json())
        .then((rep) => {
          if (!rep.ok) throw new Error(rep.erreur || "refus");
          merci(rep.statut);
        })
        .catch(() => {
          erreur.textContent = "La demande n’a pas pu être envoyée. Vérifiez votre connexion et réessayez dans un instant.";
          erreur.hidden = false;
        })
        .finally(() => { bouton.disabled = false; bouton.textContent = libelle; });
    });
  }

  /* ---------- Le lycée Paul Augier ---------- */
  G.timeline({ scrollTrigger: { trigger: ".augier", start: "top 82%" }, defaults: { ease: "expo.out" } })
    .from(".augier", { clipPath: "inset(0% 50% 0% 50%)", duration: 1.4, ease: "power4.inOut" })
    .from(".augier > *", { y: 16 * k, opacity: 0, duration: 1.1, stagger: 0.12 }, 0.6);

  /* ---------- Photos : se dévoilent, puis glissent doucement dans leur cadre ---------- */
  document.querySelectorAll(".photo-cadre img, .ouverture-photo img").forEach((img) => {
    const absente = () => { img.hidden = true; };
    if (img.complete && img.naturalWidth === 0) absente(); else img.addEventListener("error", absente);
  });
  document.querySelectorAll(".photo").forEach((f) => {
    const cadre = f.querySelector(".photo-cadre"), img = f.querySelector("img");
    G.timeline({ scrollTrigger: { trigger: f, start: "top 85%" } })
      .from(cadre, { clipPath: "inset(12% 12% 12% 12%)", duration: 1.6, ease: "power4.inOut" })
      .from(f.querySelector("figcaption"), { opacity: 0, y: 10 * k, duration: 1, ease: "expo.out" }, 0.9);
    if (!doux) G.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: "none", scrollTrigger: { trigger: f, start: "top bottom", end: "bottom top", scrub: true } });
  });

  /* ---------- Le carton : posé sur la table, puis le sceau ---------- */
  G.fromTo(".carton", { rotateX: 32 * k, rotateZ: -4 * k, y: 140 * k, opacity: 0 }, {
    rotateX: 0, rotateZ: 0, y: 0, opacity: 1, ease: "power2.out",
    scrollTrigger: { trigger: ".infos", start: "top 85%", end: "center 60%", scrub: 0.9 },
  });
  G.from(".carton-monogramme", {
    scale: doux ? 1 : 2.4, rotate: -25 * k, opacity: 0, duration: 0.9, ease: "back.out(2)",
    scrollTrigger: { trigger: ".carton", start: "top 45%" },
  });

  /* ---------- Soutenir : les lignes se tracent ---------- */
  document.querySelectorAll(".ligne-lien").forEach((l) => {
    G.from(l, { opacity: 0, y: 30 * k, duration: 1.3, ease: "expo.out", scrollTrigger: { trigger: l, start: "top 90%", onEnter: () => l.classList.add("ouvert") } });
  });

  /* ---------- Pied : le logo se dévoile ---------- */
  G.fromTo(".pied-logo", { clipPath: "inset(100% 0% 0% 0%)", yPercent: 25 * k }, {
    clipPath: "inset(0% 0% 0% 0%)", yPercent: 0, ease: "power2.out",
    scrollTrigger: { trigger: ".pied", start: "top 90%", end: "top 35%", scrub: 0.8 },
  });

  /* ---------- Souris : boutons aimantés, carton qui s'incline (curseur du système conservé) ---------- */
  if (souris) {

    if (!doux) document.querySelectorAll(".bouton, .entete-reserver, .lien-souligne, .lien-fleche").forEach((b) => {
      const bx = G.quickTo(b, "x", { duration: 0.6, ease: "power3.out" }), by = G.quickTo(b, "y", { duration: 0.6, ease: "power3.out" });
      b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); bx((e.clientX - r.left - r.width / 2) * 0.28); by((e.clientY - r.top - r.height / 2) * 0.4); });
      b.addEventListener("pointerleave", () => { bx(0); by(0); });
    });

    const carton = doux ? null : document.querySelector(".carton");
    if (carton) {
    const rx = G.quickTo(carton, "rotationX", { duration: 1.2, ease: "power3.out" });
    const ry = G.quickTo(carton, "rotationY", { duration: 1.2, ease: "power3.out" });
    document.querySelector(".infos").addEventListener("pointermove", (e) => {
      const b = carton.getBoundingClientRect();
      ry(((e.clientX - b.left) / b.width - 0.5) * 7);
      rx(-((e.clientY - b.top) / b.height - 0.5) * 7);
    });
    document.querySelector(".infos").addEventListener("pointerleave", () => { rx(0); ry(0); });
    }
  }

  addEventListener("load", () => ST.refresh());
})();
