import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import styles from '../styles/Dashboard.module.css'; // Importa o CSS

const DashboardAluno = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null); // Adicionei estado para menu ativo
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const docRef = doc(db, 'pessoa', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.tipoPessoa === 'aluno') {
              setUserData(data);
            } else {
              setError('Acesso negado. Tipo de usuário inválido.');
              navigate('/login');
            }
          } else {
            setError('Documento não encontrado.');
            navigate('/login');
          }
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error("Erro ao buscar dados do usuário:", error);
        setError('Erro ao buscar dados do usuário!');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    }
  };

  const toggleMenu = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  if (loading) return <p>Carregando...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className={styles.dashboardPage}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.painelName}>Painel do Aluno</div>
        </div>
        <ul className={styles.sidebarMenu}>
          <li
            className={`${styles.menuItem} ${activeMenu === 'treino' ? styles.active : ''}`}
            onClick={() => toggleMenu('treino')}
          >
            Treino
            <ul className={`${styles.submenu} ${activeMenu === 'treino' ? styles.show : ''}`}>
              <li><button onClick={() => navigate('/ver-treino')}>Ver Treino</button></li>
            </ul>
          </li>
          <li
            className={`${styles.menuItem} ${activeMenu === 'relatorios' ? styles.active : ''}`}
            onClick={() => toggleMenu('relatorios')}
          >
            Relatórios
            <ul className={`${styles.submenu} ${activeMenu === 'relatorios' ? styles.show : ''}`}>
              <li><button onClick={() => navigate('/relatorios-treinos')}>Treinos</button></li>
            </ul>
          </li>
        </ul>
      </div>
      <div className={styles.mainContent}>
        <div className={styles.topbar}>
          <div className={styles.topbarContent}>
            <div className={styles.logoContainer}>
              <img src="" alt="Logo da Empresa" className={styles.logo} />
              <h1 className={styles.topbarTitle}>Catus</h1>
            </div>
            <h1 className={styles.welcomeText}>Bem-vindo, {userData?.nomeCompleto}</h1>
            <button className={styles.logoutButton} onClick={handleLogout}>Deslogar</button>
          </div>
        </div>
        <div className={styles.content}>
          {/* Conteúdo principal do dashboard */}
        </div>
      </div>
    </div>
  );
};

export default DashboardAluno;
