import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import { useAuth } from '../contexts/authContext';
import styles from '../styles/VisualizarTreino.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const VisualizarTreino = () => {
  const [treinos, setTreinos] = useState([]);
  const [trainingTypes, setTrainingTypes] = useState([]);
  const [tipoTreinoFilter, setTipoTreinoFilter] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [inProgress, setInProgress] = useState(null);
  const [filteredTreinos, setFilteredTreinos] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTreinos = async () => {
      if (!currentUser) return;
  
      try {
        const alunoId = currentUser.uid;
  
        const treinosQuery = query(collection(db, 'Treino'), where('id_aluno', '==', alunoId));
        const querySnapshot = await getDocs(treinosQuery);
  
        const treinosDetalhados = await Promise.all(
          querySnapshot.docs.map(async (docTreino) => {
            const treinoData = docTreino.data();
  
            const treinoTempoQuery = query(
              collection(db, 'Treino_Tempo'),
              where('id_treino', '==', docTreino.id)
            );
            const treinoTempoSnapshot = await getDocs(treinoTempoQuery);
  
            const treinoTempoData = treinoTempoSnapshot.empty
              ? null
              : treinoTempoSnapshot.docs[0].data();
  
            const dataCriacao = treinoData.data_criacao
              ? typeof treinoData.data_criacao === 'string'
                ? new Date(treinoData.data_criacao).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
                : new Date(treinoData.data_criacao.seconds * 1000).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })
              : 'Data não disponível';
  
            const status = treinoTempoData?.status || 'Não Iniciado';
            if (status === 'Iniciado') {
              setInProgress(docTreino.id); // Sincroniza o estado inProgress
            }
  
  
            // Buscar detalhes dos equipamentos, séries e repetições
            const equipamentosDetalhados = await Promise.all(
              (treinoData.equipamentos || []).map(async (equipamento) => {
                const equipDoc = await getDoc(doc(db, 'Equipamento', equipamento.id_equipamento));
                return equipDoc.exists() ? equipDoc.data().nome : 'Equipamento não encontrado';
              })
            );
  
            const seriesDetalhadas = await Promise.all(
              (treinoData.equipamentos || []).map(async (equipamento) => {
                const serieDoc = await getDoc(doc(db, 'Serie', equipamento.id_serie));
                return serieDoc.exists() ? serieDoc.data().nome : 'Série não encontrada';
              })
            );
  
            const repeticoesDetalhadas = await Promise.all(
              (treinoData.equipamentos || []).map(async (equipamento) => {
                const repeticaoDoc = await getDoc(doc(db, 'Repeticao', equipamento.id_repeticao));
                return repeticaoDoc.exists() ? repeticaoDoc.data().nome : 'Repetição não encontrada';
              })
            );
  
            const tipoDoc = treinoData.id_tipo
              ? await getDoc(doc(db, 'Tipo', treinoData.id_tipo))
              : null;
  
            return {
              id: docTreino.id,
              ...treinoData,
              status,
              data_inicio: treinoTempoData?.data_inicio,
              data_termino: treinoTempoData?.data_termino,
              equipamento: equipamentosDetalhados.join(', '),
              serie: seriesDetalhadas.join(', '),
              repeticao: repeticoesDetalhadas.join(', '),
              tipo: tipoDoc?.exists() ? tipoDoc.data().nome : 'Tipo não encontrado',
              data_criacao: dataCriacao,
            };
          })
        );
  
        // Aplicar a lógica de mesclagem de treinos
        setTreinos((prevTreinos) => {
          const treinoMap = new Map();
          [...prevTreinos, ...treinosDetalhados].forEach((treino) => {
            treinoMap.set(treino.id, treino); // Mantém o mais recente
          });
          return Array.from(treinoMap.values());
        });
  
        // Atualizar os tipos de treino
        fetchTrainingTypesFromTreinos(treinosDetalhados);
      } catch (error) {
        console.error('Erro ao buscar treinos:', error);
      }
    };
  
    fetchTreinos();
  }, [currentUser]);

  useEffect(() => {
    const result = treinos.filter((treino) => {
      const matchesTipo = tipoTreinoFilter ? treino.id_tipo === tipoTreinoFilter : true;
      const matchesStatus = statusFilter ? treino.status === statusFilter : true;
      const matchesDataInicio = dataInicio
        ? new Date(treino.data_criacao) >= new Date(dataInicio)
        : true;
      const matchesDataFim = dataFim
        ? new Date(treino.data_criacao) <= new Date(dataFim)
        : true;

      return matchesTipo && matchesStatus && matchesDataInicio && matchesDataFim;
    });

    setFilteredTreinos(result);
  }, [treinos, tipoTreinoFilter, statusFilter, dataInicio, dataFim]);
  

  const fetchTrainingTypesFromTreinos = async (treinosDetalhados) => {
    try {
      const tipoIds = new Set(treinosDetalhados.map((treino) => treino.id_tipo).filter(Boolean));
  
      if (tipoIds.size > 0) {
        const tiposQuery = query(
          collection(db, 'Tipo'),
          where('__name__', 'in', Array.from(tipoIds))
        );
        const tiposSnapshot = await getDocs(tiposQuery);
  
        const types = tiposSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTrainingTypes(types);
      } else {
        setTrainingTypes([]); // Nenhum tipo associado aos treinos
      }
    } catch (error) {
      console.error('Erro ao buscar tipos de treino:', error);
    }
  };
  
  const fetchData = async () => {
    if (!currentUser) return;
  
    try {
      const alunoId = currentUser.uid;
  
      // Passo 1: Buscar treinos do aluno com filtros básicos
      let filters = query(collection(db, 'Treino'), where('id_aluno', '==', alunoId));
  
      // Aplicar filtro de status
      if (statusFilter) {
        const treinoTempoQuery = query(
          collection(db, 'Treino_Tempo'),
          where('status', '==', statusFilter)
        );
        const treinoTempoSnapshot = await getDocs(treinoTempoQuery);
        const treinoIds = treinoTempoSnapshot.docs.map((doc) => doc.data().id_treino);
  
        // Adicionar filtro pelo ID dos treinos obtidos
        if (treinoIds.length > 0) {
          filters = query(filters, where('__name__', 'in', treinoIds));
        } else {
          setTreinos([]); // Se não houver treinos correspondentes, definir lista vazia
          return;
        }
      }
  
      // Aplicar filtro de tipo de treino
      if (tipoTreinoFilter) {
        filters = query(filters, where('id_tipo', '==', tipoTreinoFilter));
      }
  
      // Aplicar filtro por data de início
      if (dataInicio) {
        const startTimestamp = new Date(`${dataInicio}T00:00:00`);
        filters = query(filters, where('data_criacao', '>=', startTimestamp));
      }
  
      // Aplicar filtro por data de término
      if (dataFim) {
        const endTimestamp = new Date(`${dataFim}T23:59:59`);
        filters = query(filters, where('data_criacao', '<=', endTimestamp));
      }
  
      // Buscar treinos com os filtros aplicados
      const treinosSnapshot = await getDocs(filters);
  
      // Passo 2: Processar os treinos detalhados
      const treinosDetalhados = treinosSnapshot.docs.map((docTreino) => {
        const treino = docTreino.data();
  
        // Verificar e converter `data_criacao`
        let dataCriacao = null;
        if (typeof treino.data_criacao === 'string') {
          dataCriacao = new Date(treino.data_criacao).toLocaleDateString('pt-BR');
        } else if (treino.data_criacao?.seconds) {
          dataCriacao = new Date(treino.data_criacao.seconds * 1000).toLocaleDateString('pt-BR');
        }
  
        return {
          id: docTreino.id,
          ...treino,
          data_criacao: dataCriacao, // Data convertida para exibição no card
        };
      });
  
      // Atualizar lista de treinos
      setTreinos((prevTreinos) => {
        const prevTreinoMap = new Map(prevTreinos.map((t) => [t.id, t]));
        return treinosDetalhados.map((treino) => ({
          ...treino,
          ...(prevTreinoMap.get(treino.id) || {}), // Preserva estado local
        }));
      });
    } catch (error) {
      console.error('Erro ao aplicar filtros:', error);
    }
  };
  
  

  const iniciarTreino = async (treinoId) => {
    if (!currentUser) return;

    try {
      const treinoTempoQuery = query(
        collection(db, 'Treino_Tempo'),
        where('id_treino', '==', treinoId)
      );
      const querySnapshot = await getDocs(treinoTempoQuery);

      if (querySnapshot.empty) {
        console.error('Documento correspondente em Treino_Tempo não encontrado.');
        return;
      }

      const treinoTempoDoc = querySnapshot.docs[0];
      const treinoTempoRef = doc(db, 'Treino_Tempo', treinoTempoDoc.id);

      await updateDoc(treinoTempoRef, {
        data_inicio: serverTimestamp(),
        status: 'Iniciado',
      });

      setTreinos((prevTreinos) =>
        prevTreinos.map((treino) => treino.id === treinoId
  ? {
      ...treino,
      status: 'Iniciado',
      data_inicio: new Date().toLocaleDateString('pt-BR'),
    }
  : treino
)
      );

      setInProgress(treinoId);
    } catch (error) {
      console.error('Erro ao iniciar o treino:', error);
    }
  };

  const terminarTreino = async () => {
    if (!inProgress) return;
  
    try {
      const treinoTempoQuery = query(
        collection(db, 'Treino_Tempo'),
        where('id_treino', '==', inProgress)
      );
      const querySnapshot = await getDocs(treinoTempoQuery);
  
      if (querySnapshot.empty) {
        console.error('Documento correspondente em Treino_Tempo não encontrado.');
        return;
      }
  
      const treinoTempoDoc = querySnapshot.docs[0];
      const treinoTempoRef = doc(db, 'Treino_Tempo', treinoTempoDoc.id);
  
      // Atualizar no banco de dados
      await updateDoc(treinoTempoRef, {
        data_termino: serverTimestamp(),
        status: 'Concluído',
      });
  
      // Obter os dados atualizados
      const updatedTreinoDoc = await getDoc(treinoTempoRef);
      const updatedTreinoData = updatedTreinoDoc.data();
  
      // Atualizar o estado local
      setTreinos((prevTreinos) =>
        prevTreinos.map((treino) =>
          treino.id === inProgress
            ? {
                ...treino,
                status: 'Concluído',
                data_termino: new Date(updatedTreinoData.data_termino.seconds * 1000).toLocaleDateString('pt-BR'),
              }
            : treino
        )
      );
  
      setInProgress(null);
    } catch (error) {
      console.error('Erro ao terminar o treino:', error);
    }
  };
  

  return (
    <>
      <div className={styles.header}>
        <h2>Seus Treinos</h2>
        <button className={styles.backButton} onClick={() => navigate('/dashboard-aluno')}>
          <i className="fa-solid fa-rotate-left"></i> Voltar ao Dashboard
        </button>
      </div>
      <div className={styles.filtersContainer}>
      <label>
  Tipo de Treino:
  <select
    value={tipoTreinoFilter}
    onChange={(e) => setTipoTreinoFilter(e.target.value)}
  >
    <option value="">Todos</option>
    {trainingTypes.map((type) => (
      <option key={type.id} value={type.id}>
        {type.nome}
      </option>
    ))}
  </select>
</label>
        <label>
          Data Inicial:
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </label>
        <label>
          Data Final:
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </label>
        <label>
          Status:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="Não Iniciado">Não Iniciado</option>
            <option value="Iniciado">Iniciado</option>
            <option value="Concluído">Concluído</option>
          </select>
        </label>
      </div>
      <div className={styles.treinoContainer}>
  {filteredTreinos.length === 0 ? (
    <p>Nenhum treino encontrado com os filtros selecionados.</p>
  ) : (
    filteredTreinos.map((treino) => (
      <div key={treino.id} className={styles.treinoCard}>
        <div>
          <strong>Data de Criação:</strong> {treino.data_criacao || 'Data não disponível'}
        </div>
        <div>
          <strong>Tipo de Treino:</strong> {treino.tipo}
        </div>
        <div>
          <strong>Equipamentos:</strong> {treino.equipamento}
        </div>
        <div>
          <strong>Séries:</strong> {treino.serie}
        </div>
        <div>
          <strong>Repetições:</strong> {treino.repeticao}
        </div>
        <div>
          <strong>Descrição Geral:</strong> {treino.descricao}
        </div>
        <div>
          {treino.status === 'Concluído' ? (
            <span>
              <i className="fa-solid fa-check"></i> Treino Concluído
            </span>
          ) : treino.status === 'Iniciado' ? (
            <>
              {treino.status === 'Iniciado' && (
              <button onClick={terminarTreino} className={styles.terminateButton}>
                <i className="fa-solid fa-medal"></i> Terminar Treino
              </button>
              )}
              <span>
                <i className="fa-solid fa-spinner fa-spin"></i> Em Progresso
              </span>
            </>
          ) : (
            <button
              onClick={() => iniciarTreino(treino.id)}
              disabled={inProgress && inProgress !== treino.id}
              className={styles.startButton}
            >
              <i className="fa-solid fa-play"></i> Iniciar Treino
            </button>
          )}
        </div>
      </div>
    ))
  )}
</div>
    </>
  );
};

export default VisualizarTreino;
