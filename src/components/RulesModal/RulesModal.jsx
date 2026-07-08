import React, { useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import './RulesModal.css';

const RULES_DATA = [
  {
    id: 'principles',
    title: '1. Principes Généraux',
    icon: '📜',
    content: (
      <ul className="rules-list">
        <li>Une partie est dirigée par un meneur de jeu qui rythme une alternance de phases de nuit et de jour.</li>
        <li>Durant la nuit, tous les joueurs ont les yeux fermés. Le meneur appelle à tour de rôle certains personnages afin qu'ils ouvrent les yeux et utilisent leurs pouvoirs.</li>
        <li>Chaque jour, le village se réveille, le meneur révèle les éventuelles victimes, puis les joueurs survivants débattent.</li>
        <li>Il est strictement interdit de révéler sa carte personnage aux autres joueurs.</li>
        <li>Le débat diurne se conclut par un vote au signal du meneur.</li>
        <li>Le joueur obtenant la majorité des votes est éliminé, révèle sa carte, et devient spectateur silencieux.</li>
        <li>En cas d'égalité, un second vote est organisé uniquement pour départager les ex-æquo. Si une nouvelle égalité survient, aucun joueur n'est éliminé.</li>
      </ul>
    )
  },
  {
    id: 'factions',
    title: '2. Factions & Objectifs',
    icon: '🚩',
    content: (
      <div className="factions-grid">
        <div className="faction-card wolf">
          <h4>Les Loups-Garous</h4>
          <p>Leur but est de dévorer et d'éliminer tous les autres habitants du village.</p>
        </div>
        <div className="faction-card village">
          <h4>Les Villageois</h4>
          <p>Leur objectif est de démasquer et d'éliminer tous les Loups-Garous.</p>
        </div>
        <div className="faction-card ambigu">
          <h4>Les Ambigus</h4>
          <p>Ces rôles peuvent changer d'alliance en cours de jeu. Leur but est de faire gagner le camp auquel ils finissent par appartenir.</p>
        </div>
        <div className="faction-card solitaire">
          <h4>Les Solitaires</h4>
          <p>Ces personnages ont des objectifs de victoire personnels qui priment sur ceux de leur faction initiale.</p>
        </div>
      </div>
    )
  },
  {
    id: 'wolves',
    title: '3. Les Loups-Garous',
    icon: '🐺',
    content: (
      <div className="roles-detail">
        <div className="role-entry">
          <strong>Simple Loup-Garou :</strong> Se réveille chaque nuit. Ils se concertent silencieusement pour désigner une victime.
        </div>
        <div className="role-entry">
          <strong>Infect Père des Loups :</strong> Dévore avec les loups. Une seule fois, il peut infecter un joueur (qui n'est pas déjà loup, ni la victime de ce tour) pour le rallier secrètement à la meute.
        </div>
        <div className="role-entry">
          <strong>Grand-Méchant-Loup :</strong> Tant qu'aucun loup n'est mort, il se réveille une seconde fois seul pour dévorer une autre cible.
        </div>
      </div>
    )
  },
  {
    id: 'villagers',
    title: '4. Les Villageois',
    icon: '🏘️',
    content: (
      <div className="roles-detail grid">
        <div className="role-entry"><strong>Simple Villageois :</strong> Aucune compétence nocturne. Participe aux débats et votes.</div>
        <div className="role-entry"><strong>Cupidon :</strong> Lie 2 joueurs (Amoureux). Si l'un meurt, l'autre aussi. Nouveau but si couple mixte.</div>
        <div className="role-entry"><strong>Voyante :</strong> Espionne une carte de rôle chaque nuit.</div>
        <div className="role-entry"><strong>Deux Sœurs :</strong> Se reconnaissent la première nuit.</div>
        <div className="role-entry"><strong>Petite Fille :</strong> Peut espionner les loups la nuit. Mourre à la place de la cible si vue.</div>
        <div className="role-entry"><strong>Renard :</strong> Flaire un groupe de 3 joueurs. Perd son pouvoir s'il se trompe.</div>
        <div className="role-entry"><strong>Chevalier :</strong> Si dévoré, contamine le loup à sa gauche qui meurt la nuit suivante.</div>
        <div className="role-entry"><strong>Corbeau :</strong> Il désigne en secret un joueur qui recevra 2 voix supplémentaires contre lui lors du prochain tribunal.</div>
        <div className="role-entry"><strong>Ancien :</strong> Survit à une attaque. Si tué par le village, les villageois perdent leurs pouvoirs.</div>
        <div className="role-entry"><strong>Sorcière :</strong> Potion de Guérison et Potion de Mort (1 usage chacune).</div>
        <div className="role-entry"><strong>Montreur d'Ours :</strong> Le meneur grogne si un loup est son voisin.</div>
        <div className="role-entry"><strong>Chasseur :</strong> Élimine un joueur de son choix à sa mort.</div>
      </div>
    )
  },
  {
    id: 'ambigu',
    title: '5. Les Ambigus',
    icon: '🌗',
    content: (
      <div className="roles-detail">
        <div className="role-entry"><strong>Enfant Sauvage :</strong> Choisit un modèle. Devient loup si le modèle meurt.</div>
        <div className="role-entry"><strong>Chien-Loup :</strong> Choisit définitivement son camp la première nuit.</div>
      </div>
    )
  },
  {
    id: 'solitaires',
    title: '6. Les Solitaires',
    icon: '🃏',
    content: (
      <div className="roles-detail">
        <div className="role-entry"><strong>Loup-Garou Blanc :</strong> Dévore avec les loups. Une nuit sur deux, il peut éliminer un autre loup.</div>
        <div className="role-entry"><strong>Joueur de Flûte :</strong> Charme 2 joueurs par nuit. Gagne si tout le village vivant est charmé.</div>
        <div className="role-entry"><strong>Ange :</strong> Doit être éliminé au TOUR 1 pour gagner. Sinon devient Simple Villageois.</div>
      </div>
    )
  },
  {
    id: 'captain',
    title: '7. Le Capitaine',
    icon: '🎖️',
    content: (
      <ul className="rules-list">
        <li>Élu par le village. Son vote compte double.</li>
        <li>En cas d'égalité au tribunal, il tranche.</li>
        <li>À sa mort, il choisit son successeur.</li>
      </ul>
    )
  },
  {
    id: 'order',
    title: '8. Ordre d\'Appel (Nuit)',
    icon: '🌙',
    content: (
      <div className="night-order-display">
        <ol className="order-list">
          <li>Voyante</li>
          <li>Loups-Garous (Petite Fille)</li>
          <li>Loup-Garou Blanc (1/2 nuits)</li>
          <li>Infect Père des Loups</li>
          <li>Grand-Méchant-Loup</li>
          <li>Sorcière</li>
          <li>Renard</li>
          <li>Corbeau</li>
          <li>Joueur de Flûte</li>
          <li>Joueurs charmés</li>
        </ol>
        <p className="note-text"><em>*Préliminaire (Nuit 1) : Cupidon, Amoureux, Deux Sœurs, Enfant Sauvage, Montreur d'Ours, Chien-Loup.</em></p>
      </div>
    )
  }
];

export default function RulesModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('principles');
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div className="rules-modal-container" ref={modalRef} role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <header className="rules-modal-header">
          <h2>📜 Grimoire des Règles</h2>
          <button className="rules-close-btn" onClick={onClose} aria-label="Fermer">✕</button>
        </header>

        <div className="rules-modal-body">
          <aside className="rules-sidebar">
            {RULES_DATA.map(section => (
              <button
                key={section.id}
                className={`rules-nav-item ${activeTab === section.id ? 'active' : ''}`}
                onClick={() => setActiveTab(section.id)}
              >
                <span className="rules-nav-icon">{section.icon}</span>
                <span className="rules-nav-text">{section.title.split('. ')[1]}</span>
              </button>
            ))}
          </aside>

          <main className="rules-content">
            <div className="rules-content-inner">
              <h3>{RULES_DATA.find(s => s.id === activeTab).title}</h3>
              <div className="rules-text">
                {RULES_DATA.find(s => s.id === activeTab).content}
              </div>
            </div>
          </main>
        </div>

        <footer className="rules-modal-footer">
          <p>Version "Best Of Les Loups-Garous de Thiercelieux"</p>
          <button className="rules-footer-btn" onClick={onClose}>J'ai compris</button>
        </footer>
      </div>
    </div>
  );
}
