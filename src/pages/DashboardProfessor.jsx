import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { Chart, registerables } from 'chart.js';
import styles from '../styles/Dashboard.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

Chart.register(...registerables);

const DashboardProfessor = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMenu, setActiveMenu] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const docRef = doc(db, 'Pessoa', user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.tipo_pessoa === 'professor') {
              setUserData({ ...data, uid: user.uid });
            } else {
              setError('Acesso negado.');
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
        setError('Erro ao buscar dados do usuário!');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, auth]);

  useEffect(() => {
    const loadCharts = async () => {
      if (!userData) return;

      try {
        // Consultar alunos cadastrados
        const alunosQuery = query(
          collection(db, 'Pessoa'),
          where('id_professor', '==', userData.uid),
          where('tipo_pessoa', '==', 'aluno')
        );
        const alunosSnapshot = await getDocs(alunosQuery);
        const totalAlunos = alunosSnapshot.size;

        // Consultar treinos criados
        const treinosQuery = query(
          collection(db, 'Treino'),
          where('id_professor', '==', userData.uid)
        );
        const treinosSnapshot = await getDocs(treinosQuery);

        const meses = Array(12).fill(0);
        treinosSnapshot.forEach((doc) => {
          const treinoData = doc.data();
          let dataCriacao;
        
          // Verifica se é um timestamp do Firebase ou uma string ISO
          if (treinoData.data_criacao?.toDate) {
            dataCriacao = treinoData.data_criacao.toDate(); // Convertendo timestamp
          } else {
            dataCriacao = new Date(treinoData.data_criacao); // Convertendo string ISO
          }
        
          // Incrementa o mês correspondente, se o ano for o atual
          if (dataCriacao.getFullYear() === new Date().getFullYear()) {
            meses[dataCriacao.getMonth()]++;
          }
        });

        // Criar gráficos
        createPieChart('alunosCadastradosChart', ['Alunos Cadastrados'], [totalAlunos], ['#007BFF']);
        createBarChart('treinosCriadosChart', meses, '#45ffbc');
        await createCadastroCharts(userData.uid);
      } catch (error) {
        console.error('Erro ao carregar gráficos:', error);
      }
    };

    loadCharts();
  }, [userData]);

  const createPieChart = (id, labels, data, backgroundColor) => {
    const ctx = document.getElementById(id).getContext('2d');
    new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  };

  const createBarChart = (id, data, backgroundColor) => {
    const ctx = document.getElementById(id).getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
        datasets: [
          {
            label: 'Total de Treinos Criados',
            data,
            backgroundColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  };

  const createHorizontalBarChart = (id, labels, data, backgroundColor) => {
    const ctx = document.getElementById(id).getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Quantidade de Cadastros',
            data,
            backgroundColor,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
      },
    });
  };

  const createCadastroCharts = async (professorId) => {
    const collections = ['Equipamento', 'Serie', 'Repeticao', 'Tipo'];
    const counts = [];

    for (const collectionName of collections) {
      const querySnapshot = await getDocs(
        query(collection(db, collectionName), where('id_professor', '==', professorId))
      );
      counts.push(querySnapshot.size);
    }

    const totalCadastros = counts.reduce((sum, count) => sum + count, 0);

    const labels = ['Equipamentos', 'Séries', 'Repetições', 'Tipos de Treino'];
    const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'];

    createHorizontalBarChart('quantidadeCadastroChart', labels, counts, colors);

    // Novo gráfico de pizza para total de cadastros com cor laranja
    createPieChart(
      'totalCadastroChart',
      ['Total de Cadastros'],
      [totalCadastros],
      ['#FFA500']
    );
  };

  const toggleSubmenu = (menu) => {
    setActiveMenu((prevMenu) => (prevMenu === menu ? null : menu));
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao deslogar:', error);
    }
  };

  if (loading) return <p>Carregando...</p>;
  if (error) return <p>{error}</p>;

  return (
    <div className={styles.dashboardPage}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.painelName}>Painel do Professor</div>
        </div>
        <ul className={styles.sidebarMenu}>
          <li
            className={`${styles.menuItem} ${activeMenu === 'aluno' ? styles.active : ''}`}
            onClick={() => toggleSubmenu('aluno')}
          >
            Aluno
            <ul className={`${styles.submenu} ${activeMenu === 'aluno' ? styles.show : ''}`}>
              <li>
                <button onClick={() => navigate('/cadastro-aluno')}>Cadastrar Aluno</button>
              </li>
            </ul>
          </li>
          <li
            className={`${styles.menuItem} ${activeMenu === 'treino' ? styles.active : ''}`}
            onClick={() => toggleSubmenu('treino')}
          >
            Treino
            <ul className={`${styles.submenu} ${activeMenu === 'treino' ? styles.show : ''}`}>
              <li><button onClick={() => navigate('/cadastro-equipamento')}>Cadastrar Equipamento</button></li>
              <li><button onClick={() => navigate('/cadastro-serie')}>Cadastrar Séries</button></li>
              <li><button onClick={() => navigate('/cadastro-repeticao')}>Cadastrar Repetições</button></li>
              <li><button onClick={() => navigate('/cadastro-tipo')}>Cadastrar Tipo de Treino</button></li>
              <li><button onClick={() => navigate('/cadastro-treino')}>Cadastrar Treino</button></li>
            </ul>
          </li>
          <li
            className={`${styles.menuItem} ${activeMenu === 'relatorio' ? styles.active : ''}`}
            onClick={() => toggleSubmenu('relatorio')}
          >
            Relatórios
            <ul className={`${styles.submenu} ${activeMenu === 'relatorio' ? styles.show : ''}`}>
              <li><button onClick={() => navigate('/relatorio-treino-geral')}>Relatório de Treinos Geral </button></li>
              <li><button onClick={() => navigate('/relatorio-treino-professor')}>Relatório de Treinos</button></li>
              <li>
                <button onClick={() => navigate('/aluno-cadastrado')}>Alunos Cadastrados</button>
              </li>
            </ul>
          </li>
          <li
            className={`${styles.menuItem} ${activeMenu === 'perfil' ? styles.active : ''}`}
            onClick={() => toggleSubmenu('perfil')}
          >
            Perfil
            <ul className={`${styles.submenu} ${activeMenu === 'perfil' ? styles.show : ''}`}>
              <li><button onClick={() => navigate('/editar-usuario')}>Editar Perfil</button></li>
            </ul>
          </li>
        </ul>
      </div>
      <div className={styles.mainContent}>
        <div className={styles.topbar}>
          <div className={styles.topbarContent}>
            <div>Bem-vindo, {userData?.nome_completo || 'Usuário'}</div>
            <button className={styles.logoutButton} onClick={handleLogout}>
            <i className="fa-solid fa-right-from-bracket"></i> Logout</button>
          </div>
        </div>
        <div className={styles.contentArea}>
          <div className={styles.row}>
            <div className={styles.chartContainer}>
              <h3>Total de Alunos Cadastrados</h3>
              <canvas id="alunosCadastradosChart"></canvas>
            </div>
            <div className={styles.chartContainer}>
              <h3>Total de Treinos Criados por Mês</h3>
              <canvas id="treinosCriadosChart"></canvas>
            </div>
          </div>
          <div className={styles.row}>
            <div className={styles.chartContainer}>
              <h3>Quantidade de Cadastros por Categoria</h3>
              <canvas id="quantidadeCadastroChart"></canvas>
            </div>
            <div className={styles.chartContainer}>
              <h3>Total de Cadastros das Categorias</h3>
              <canvas id="totalCadastroChart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardProfessor;
