import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Field, Form, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { auth, db } from '../config/firebaseConfig';
import { createUserWithEmailAndPassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/authContext';
import styles from '../styles/CadastroAluno.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

const CadastroAluno = () => {
  const navigate = useNavigate();
  const { currentUser, getStoredCredentials } = useAuth();

  const [formData, setFormData] = useState({
    nome_completo: '',
    data_nascimento: '',
    genero: '',
    cep: '',
    cidade: '',
    uf: '',
    endereco: '',
    numero_casa: '',
    bairro: '',
    complemento: '',
    telefone: '',
    email: '',
    senha: '',
  });

  useEffect(() => {
    if (!currentUser) {
      console.warn('Nenhum usuário logado. Redirecionando para o Dashboard.');
      navigate('/dashboard-professor');
    } else {
      console.log('Usuário atual:', currentUser);
    }
  }, [currentUser, navigate]);

  // Schema de validação com Yup
  const validationSchema = Yup.object({
    nome_completo: Yup.string().required('Nome completo é obrigatório'),
    data_nascimento: Yup.date().required('Data de nascimento é obrigatória'),
    genero: Yup.string().required('Gênero é obrigatório'),
    cep: Yup.string()
      .matches(/^\d{5}-?\d{3}$/, 'CEP inválido')
      .nullable(), // CEP não obrigatório
    cidade: Yup.string().required('Cidade é obrigatória'),
    uf: Yup.string().length(2, 'UF deve ter 2 caracteres').required('UF é obrigatório'),
    endereco: Yup.string().required('Endereço é obrigatório'),
    numero_casa: Yup.string().required('Número da residência é obrigatório'),
    bairro: Yup.string().required('Bairro é obrigatório'),
    telefone: Yup.string()
      .matches(/^\(\d{2}\) \d{5}-\d{4}$/, 'Telefone inválido. Use o formato (xx) xxxxx-xxxx')
      .required('Telefone é obrigatório. Use o formato (xx) xxxxx-xxxx'),
    email: Yup.string().email('E-mail inválido').required('E-mail é obrigatório'),
    senha: Yup.string()
      .min(6, 'Senha deve ter pelo menos 6 caracteres')
      .required('Senha é obrigatória'),
  });

  const reauthenticateUser = async () => {
    try {
      if (getStoredCredentials) {
        const storedCredentials = getStoredCredentials();
        if (storedCredentials) {
          const { email, password } = storedCredentials;
          const credential = EmailAuthProvider.credential(email, password);
          await reauthenticateWithCredential(auth.currentUser, credential);
          console.log('Reautenticação bem-sucedida.');
        } else {
          console.warn('Credenciais ausentes no armazenamento local.');
        }
      } else {
        console.warn('Função getStoredCredentials não encontrada.');
      }
    } catch (error) {
      console.error('Erro na reautenticação:', error.message);
      throw error;
    }
  };

  const onSubmit = async (values, { resetForm, setSubmitting }) => {
    setSubmitting(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.senha);
      const user = userCredential.user;

      await setDoc(doc(db, 'Pessoa', user.uid), {
        ...values,
        id_aluno: user.uid,
        id_professor: currentUser.uid,
        tipo_pessoa: 'aluno',
        data_criacao: serverTimestamp(),
      });

      alert('Aluno cadastrado com sucesso!');
      resetForm();

      navigate('/dashboard-professor');
    } catch (error) {
      console.error('Erro ao cadastrar aluno:', error.message);
      alert(`Erro ao cadastrar aluno: ${error.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchAddressByCep = async (cep, setFieldValue) => {
    if (!cep) return;
    try {
      const response = await axios.get(`https://viacep.com.br/ws/${cep.replace('-', '')}/json/`);
      const data = response.data;

      if (!data.erro) {
        setFieldValue('cidade', data.localidade || '');
        setFieldValue('uf', data.uf || '');
        setFieldValue('endereco', data.logradouro || '');
        setFieldValue('bairro', data.bairro || '');
        setFieldValue('complemento', data.complemento || '');
      } else {
        alert('CEP inválido ou não encontrado!');
      }
    } catch (error) {
      alert('Erro ao buscar informações do CEP: Deve Conter no mínimo 8 Dígitos');
    }
  };

  const voltarAoDashboard = async () => {
    if (currentUser) {
      navigate('/dashboard-professor');
    } else {
      alert('Erro: Faça login novamente.');
      navigate('/login');
    }
  };

  const handleTelefoneChange = (e, setFieldValue) => {
    const input = e.target;
    const rawValue = input.value.replace(/\D/g, ''); // Remove todos os caracteres não numéricos
    let formatted = '';

    // Formata o número enquanto digita
    if (rawValue.length > 0) {
      formatted = `(${rawValue.slice(0, 2)}`; // Adiciona o DDD com parênteses
      if (rawValue.length > 2) {
        formatted += `) ${rawValue.slice(2, 7)}`; // Adiciona o espaço e os primeiros dígitos
      }
      if (rawValue.length > 7) {
        formatted += `-${rawValue.slice(7, 11)}`; // Adiciona o hífen e os dígitos finais
      }
    }

    // Atualiza o valor do telefone no Formik
    setFieldValue('telefone', formatted);

    // Reposiciona o cursor
    const cursorPosition = input.selectionStart;
    const diff = formatted.length - input.value.length;

    // O cursor será ajustado mesmo ao apagar símbolos como "-"
    requestAnimationFrame(() => {
      const adjustedPosition = Math.max(0, cursorPosition + diff);
      input.setSelectionRange(adjustedPosition, adjustedPosition);
    });
  };
  

  return (
    <div className={styles.cadastroPage}>
      <div className={styles.topBar}>
        <h2 className={styles.cadastroHeading}>Cadastrar Aluno</h2>
        <button onClick={voltarAoDashboard} className={styles.backButton}>
        <i className="fa-solid fa-rotate-left"></i> Voltar ao Dashboard
        </button>
      </div>
      <div className={styles.cadastroContainer}>
        <Formik
          initialValues={{
            nome_completo: "",
            data_nascimento: "",
            genero: "",
            cep: "",
            cidade: "",
            uf: "",
            endereco: "",
            numero_casa: "",
            bairro: "",
            complemento: "",
            telefone: "",
            email: "",
            senha: "",
          }}
          validationSchema={validationSchema}
          onSubmit={onSubmit}
        >
          {({ setFieldValue, values, isSubmitting }) => (
            <Form>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Nome Completo</label>
                  <Field name="nome_completo" type="text" className={styles.formControl} />
                  <ErrorMessage name="nome_completo" component="div" className={styles.error} />
                </div>
                <div className={styles.formGroup}>
                  <label>Data de Nascimento</label>
                  <Field name="data_nascimento" type="date" className={styles.formControl} />
                  <ErrorMessage name="data_nascimento" component="div" className={styles.error} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Gênero</label>
                  <Field name="genero" as="select" className={styles.formControl}>
                    <option value="">Selecione</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outros">Outros</option>
                  </Field>
                  <ErrorMessage name="genero" component="div" className={styles.error} />
                </div>
                <div className={styles.formGroup}>
                  <label>CEP</label>
                  <Field
                    name="cep"
                    type="text"
                    className={styles.formControl}
                    onBlur={() => fetchAddressByCep(values.cep, setFieldValue)}
                    placeholder="00000-000"
                  />
                  <ErrorMessage name="cep" component="div" className={styles.error} />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Cidade</label>
                  <Field name="cidade" type="text" className={styles.formControl} />
                  <ErrorMessage name="cidade" component="div" className={styles.error} />
                </div>

                <div className={styles.formGroup}>
                  <label>UF</label>
                  <Field name="uf" type="text" className={styles.formControl} />
                  <ErrorMessage name="uf" component="div" className={styles.error} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Endereço</label>
                  <Field name="endereco" type="text" className={styles.formControl} />
                  <ErrorMessage name="endereco" component="div" className={styles.error} />
                </div>

                <div className={styles.formGroup}>
                  <label>Número da Residência</label>
                  <Field name="numero_casa" type="text" className={styles.formControl} />
                  <ErrorMessage name="numero_casa" component="div" className={styles.error} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Bairro</label>
                  <Field name="bairro" type="text" className={styles.formControl} />
                  <ErrorMessage name="bairro" component="div" className={styles.error} />
                </div>

                <div className={styles.formGroup}>
                  <label>Complemento</label>
                  <Field name="complemento" type="text" className={styles.formControl} />
                  <ErrorMessage name="complemento" component="div" className={styles.error} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Telefone</label>
                  <Field
                    name="telefone"
                    type="text"
                    className={styles.formControl}
                    value={values.telefone}
                    onChange={(e) => handleTelefoneChange(e, setFieldValue)}
                    placeholder="(xx) xxxxx-xxxx"
                  />
                  <ErrorMessage name="telefone" component="div" className={styles.error} />
                </div>
              
              <div className={styles.formGroup}>
                  <label>E-mail</label>
                  <Field name="email" type="email" className={styles.formControl} 
                  placeholder="exemplo@exemplo.com"
                  />
                  <ErrorMessage name="email" component="div" className={styles.error} />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label>Senha</label>
                <Field name="senha" type="password" className={styles.formControl} />
                <ErrorMessage name="senha" component="div" className={styles.error} />
              </div>
              <div className={styles.formGroup}>
                <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus"></i> Cadastrar
                    </>
                  )}
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default CadastroAluno;
