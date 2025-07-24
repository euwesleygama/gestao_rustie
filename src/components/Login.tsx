import React, { useState } from 'react';
import { User, Lock, Mail, Store, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface LoginProps {
  onLogin: (userData: any) => void;
}



const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    deliveryName: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!formData.email) {
      newErrors.push('Email é obrigatório');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.push('Email inválido');
    }

    if (!formData.password) {
      newErrors.push('Senha é obrigatória');
    } else if (formData.password.length < 6) {
      newErrors.push('Senha deve ter pelo menos 6 caracteres');
    }

    if (!isLogin) {
      if (!formData.name) {
        newErrors.push('Nome é obrigatório');
      }
      if (!formData.deliveryName) {
        newErrors.push('Nome do delivery é obrigatório');
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.push('Senhas não conferem');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setErrors([]);

    try {
      if (isLogin) {
        // Login com Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        
        if (error || !data.user) {
          setErrors(['Email ou senha incorretos']);
          setLoading(false);
          return;
        }
        
        console.log('🔐 Login bem-sucedido, user ID:', data.user.id);
        console.log('📧 Email do usuário:', data.user.email);
        
        // Buscar dados extras do usuário na tabela 'usuarios'
        let { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('auth_id', data.user.id)
          .single();
          
        console.log('🔍 Busca por auth_id:', { userData, userError });
        
        // Se não existir, insere os dados extras
        if (userError && userError.code === 'PGRST116') {
          console.log('⚠️ Usuário não encontrado por auth_id, tentando por email...');
          
          // Tentar buscar por email
          const { data: userByEmail, error: emailError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', formData.email)
            .single();
              
          console.log('📧 Busca por email:', { userByEmail, emailError });
          
          if (userByEmail && !emailError) {
            // Usuário existe mas não tem auth_id, atualizar
            console.log('🔄 Atualizando auth_id do usuário existente...');
            const { error: updateError } = await supabase
              .from('usuarios')
              .update({ auth_id: data.user.id })
              .eq('id', userByEmail.id);
                
            if (updateError) {
              console.error('❌ Erro ao atualizar auth_id:', updateError);
              setErrors(['Erro ao atualizar dados do usuário.']);
              setLoading(false);
              return;
            }
              
            userData = { ...userByEmail, auth_id: data.user.id };
          } else {
            // Criar novo usuário na tabela usuarios
            console.log('➕ Criando novo usuário na tabela usuarios...');
            const { error: insertError } = await supabase.from('usuarios').insert([
              {
                auth_id: data.user.id,
                nome: data.user.email?.split('@')[0] || 'Usuário',
                email: formData.email,
                nome_delivery: 'Meu Delivery',
                senha_hash: null, // Campo opcional quando usando Supabase Auth
                ativo: true
              },
            ]);
            
            if (insertError) {
              console.error('❌ Erro ao inserir usuário:', insertError);
              setErrors(['Erro ao salvar dados extras do usuário.']);
              setLoading(false);
              return;
            }
            
            // Buscar novamente após inserir
            const { data: newUserData } = await supabase
              .from('usuarios')
              .select('*')
              .eq('auth_id', data.user.id)
              .single();
            userData = newUserData;
          }
        }
          
        console.log('✅ Dados finais do usuário:', userData);
        onLogin({ ...data.user, ...userData });
        
      } else {
        // Verificar se o email já existe
        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id')
          .eq('email', formData.email)
          .single();
        
        if (existingUser) {
          setErrors(['Este email já está cadastrado. Use outro email ou faça login.']);
          setLoading(false);
          return;
        }

        try {
          // PRIMEIRO: Criar registro na tabela usuarios
          console.log('📝 Criando registro na tabela usuarios...');
          
          // Validação adicional de segurança
          if (!formData.name || !formData.email || !formData.deliveryName) {
            setErrors(['Todos os campos são obrigatórios.']);
            setLoading(false);
            return;
          }
          
          const { data: newUserData, error: insertError } = await supabase
            .from('usuarios')
            .insert([
              {
                nome: formData.name.trim(),
                email: formData.email.trim().toLowerCase(),
                nome_delivery: formData.deliveryName.trim(),
                senha_hash: null, // Campo opcional quando usando Supabase Auth
                ativo: true
              },
            ])
            .select()
            .single();
          
          if (insertError) {
            console.error('❌ Erro ao inserir usuário na tabela usuarios:', insertError);
            setErrors(['Erro ao criar perfil do usuário. Tente novamente.']);
            setLoading(false);
            return;
          }
          
          console.log('✅ Usuário criado com sucesso na tabela usuarios:', newUserData.id);
          
          // SEGUNDO: Criar conta no Supabase Auth
          console.log('🔐 Criando conta no Supabase Auth...');
          const { data, error } = await supabase.auth.signUp({
            email: formData.email.trim().toLowerCase(),
            password: formData.password,
          });
          
          if (error || !data.user) {
            console.error('❌ Erro ao criar conta no Supabase Auth:', error);
            // Se falhar no Auth, remover o registro da tabela usuarios
            await supabase
              .from('usuarios')
              .delete()
              .eq('id', newUserData.id);
            setErrors(['Erro ao criar conta: ' + (error?.message || 'Desconhecido')]);
            setLoading(false);
            return;
          }
          
          console.log('✅ Usuário criado no Supabase Auth:', data.user.id);
          
          // TERCEIRO: Atualizar auth_id na tabela usuarios
          console.log('🔄 Atualizando auth_id na tabela usuarios...');
          const { error: updateError } = await supabase
            .from('usuarios')
            .update({ auth_id: data.user.id })
            .eq('id', newUserData.id);
            
          if (updateError) {
            console.error('❌ Erro ao atualizar auth_id:', updateError);
            setErrors(['Erro ao vincular conta. Tente novamente.']);
            setLoading(false);
            return;
          }
          
          console.log('✅ Auth_id atualizado com sucesso');
          
          // QUARTO: Buscar dados finais do usuário
          const { data: finalUserData, error: fetchError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', newUserData.id)
            .single();
            
          if (fetchError) {
            console.error('❌ Erro ao buscar dados finais do usuário:', fetchError);
            setErrors(['Conta criada com sucesso! Verifique seu email para confirmar.']);
            setIsLogin(true);
            resetForm();
            setLoading(false);
            return;
          }
          
          console.log('✅ Dados finais do usuário:', finalUserData);
          
          // QUINTO: Não fazer login automático. Apenas exibir mensagem e voltar para login
          setErrors(['Conta criada com sucesso! Verifique seu email para confirmar antes de fazer login.']);
          setIsLogin(true);
          resetForm();
          setLoading(false);
          return;
          
        } catch (error) {
          console.error('❌ Erro durante criação de conta:', error);
          setErrors(['Erro interno durante criação de conta. Tente novamente.']);
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('❌ Erro no login:', error);
      setErrors(['Erro interno. Tente novamente.']);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      deliveryName: '',
      password: '',
      confirmPassword: ''
    });
    setErrors([]);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-card animate-scaleIn">
          <div className="login-header">
            <div className="login-logo">
              <Store size={32} />
              <h1>DeliveryPro</h1>
            </div>
            <p className="login-subtitle">
              {isLogin ? 'Faça login em sua conta' : 'Crie sua conta de delivery'}
            </p>
          </div>

          {errors.length > 0 && (
            <div className="alert alert-danger animate-slideIn">
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {!isLogin && (
              <>
                <div className="form-group">
                  <label>Nome Completo</label>
                  <div className="input-with-icon">
                    <User size={20} />
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Seu nome completo"
                      required={!isLogin}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Nome do Delivery</label>
                  <div className="input-with-icon">
                    <Store size={20} />
                    <input
                      type="text"
                      value={formData.deliveryName}
                      onChange={(e) => setFormData({ ...formData, deliveryName: e.target.value })}
                      placeholder="Nome do seu delivery"
                      required={!isLogin}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label>Email</label>
              <div className="input-with-icon">
                <Mail size={20} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>Senha</label>
              <div className="input-with-icon">
                <Lock size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Sua senha"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="form-group">
                <label>Confirmar Senha</label>
                <div className="input-with-icon">
                  <Lock size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    placeholder="Confirme sua senha"
                    required={!isLogin}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary login-btn"
              disabled={loading}
            >
              {loading ? (
                <div className="loading-spinner" />
              ) : (
                <>
                  {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                  {isLogin ? 'Entrar' : 'Criar Conta'}
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button 
                type="button" 
                className="link-button"
                onClick={toggleMode}
              >
                {isLogin ? 'Criar conta' : 'Fazer login'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login; 