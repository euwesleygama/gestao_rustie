import React, { useState, useEffect } from 'react';
import { User, Mail, Store, Lock, Calendar, Edit2, Save, X, Eye, EyeOff, Check } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface UserData {
  id: string;
  name: string;
  email: string;
  deliveryName: string;
  password: string;
  createdAt: string;
  id_auth: string; // Adicionado para acessar o ID de autenticação
}

interface PerfilUsuarioProps {
  currentUser: UserData;
  onUserUpdate: (userData: UserData) => void;
}

const PerfilUsuario: React.FC<PerfilUsuarioProps> = ({ currentUser, onUserUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: currentUser.name,
    email: currentUser.email,
    deliveryName: currentUser.deliveryName,
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData({
      name: currentUser.name,
      email: currentUser.email,
      deliveryName: currentUser.deliveryName,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  }, [currentUser]);

  const validateForm = () => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) {
      newErrors.push('Nome é obrigatório');
    }

    if (!formData.email.trim()) {
      newErrors.push('Email é obrigatório');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.push('Email inválido');
    }

    if (!formData.deliveryName.trim()) {
      newErrors.push('Nome do delivery é obrigatório');
    }

    // Validação de senha apenas se estiver tentando alterar
    if (formData.newPassword || formData.confirmPassword) {
      if (!formData.currentPassword) {
        newErrors.push('Senha atual é obrigatória para alterar a senha');
      } else if (formData.currentPassword !== currentUser.password) {
        newErrors.push('Senha atual incorreta');
      }

      if (formData.newPassword.length < 6) {
        newErrors.push('Nova senha deve ter pelo menos 6 caracteres');
      }

      if (formData.newPassword !== formData.confirmPassword) {
        newErrors.push('Confirmação de senha não confere');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setSuccess('');
    setErrors([]);

    try {
      // Verificar se o email já está sendo usado por outro usuário
      const { data: emailExists, error: emailError } = await supabase
        .from('usuarios')
        .select('id_auth')
        .eq('email', formData.email)
        .neq('id_auth', currentUser.id_auth)
        .maybeSingle();
      if (emailExists) {
        setErrors(['Este email já está sendo usado por outro usuário']);
        setLoading(false);
        return;
      }

      // Atualizar dados extras na tabela 'usuarios'
      const { error: updateError } = await supabase
        .from('usuarios')
        .update({
          name: formData.name.trim(),
          email: formData.email.trim(),
          deliveryName: formData.deliveryName.trim(),
        })
        .eq('id_auth', currentUser.id_auth);
      if (updateError) {
        setErrors(['Erro ao atualizar informações do usuário.']);
        setLoading(false);
        return;
      }

      // Atualizar email no Auth se mudou
      if (formData.email !== currentUser.email) {
        const { error: emailAuthError } = await supabase.auth.updateUser({ email: formData.email });
        if (emailAuthError) {
          setErrors(['Erro ao atualizar email de autenticação.']);
          setLoading(false);
          return;
        }
      }

      // Atualizar senha se necessário
      if (formData.newPassword) {
        const { error: passError } = await supabase.auth.updateUser({ password: formData.newPassword });
        if (passError) {
          setErrors(['Erro ao atualizar senha.']);
          setLoading(false);
          return;
        }
      }

      // Buscar dados atualizados
      const { data: updatedUserData } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id_auth', currentUser.id_auth)
        .single();

      onUserUpdate({ ...currentUser, ...updatedUserData });
      setSuccess('Informações atualizadas com sucesso!');
      setIsEditing(false);
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setErrors(['Erro ao salvar as informações. Tente novamente.']);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: currentUser.name,
      email: currentUser.email,
      deliveryName: currentUser.deliveryName,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setErrors([]);
    setSuccess('');
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Data não disponível';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Data inválida';
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <h2>Perfil da Conta</h2>
        <p>Gerencie suas informações pessoais e configurações da conta</p>
      </div>

      <div className="glass-card">
        <div className="card-header">
          <h3>Informações da Conta</h3>
          {!isEditing && (
            <button 
              className="btn btn-secondary"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 size={16} />
              Editar
            </button>
          )}
        </div>

        {success && (
          <div className="alert alert-success animate-slideIn">
            <Check size={16} />
            {success}
          </div>
        )}

        {errors.length > 0 && (
          <div className="alert alert-danger animate-slideIn">
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="profile-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nome Completo</label>
              <div className="input-with-icon">
                <User size={20} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Seu nome completo"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Email</label>
              <div className="input-with-icon">
                <Mail size={20} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!isEditing}
                  placeholder="seu@email.com"
                />
              </div>
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
                disabled={!isEditing}
                placeholder="Nome do seu delivery"
              />
            </div>
          </div>

          {isEditing && (
            <>
              <div className="form-divider">
                <span>Alterar Senha (opcional)</span>
              </div>

              <div className="form-group">
                <label>Senha Atual</label>
                <div className="input-with-icon">
                  <Lock size={20} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.currentPassword}
                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                    placeholder="Digite sua senha atual"
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

              <div className="form-row">
                <div className="form-group">
                  <label>Nova Senha</label>
                  <div className="input-with-icon">
                    <Lock size={20} />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={formData.newPassword}
                      onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                      placeholder="Nova senha (mín. 6 caracteres)"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirmar Nova Senha</label>
                  <div className="input-with-icon">
                    <Lock size={20} />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      placeholder="Confirme a nova senha"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Conta Criada em</label>
            <div className="input-with-icon">
              <Calendar size={20} />
              <input
                type="text"
                value={formatDate(currentUser.createdAt)}
                disabled
                className="readonly-input"
              />
            </div>
          </div>

          {isEditing && (
            <div className="form-actions">
              <button 
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={loading}
              >
                <X size={16} />
                Cancelar
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <div className="loading-spinner" />
                ) : (
                  <>
                    <Save size={16} />
                    Salvar Alterações
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div className="card-header">
          <h3>Informações da Conta</h3>
        </div>
        
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">ID da Conta:</span>
            <span className="info-value">{currentUser.id}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Status:</span>
            <span className="info-value status-active">Ativa</span>
          </div>
          <div className="info-item">
            <span className="info-label">Tipo:</span>
            <span className="info-value">Conta Delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfilUsuario; 