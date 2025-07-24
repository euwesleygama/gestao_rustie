import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

interface UserContextType {
  user: any;
  setUser: (user: any) => void;
  logout: () => void;
  loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = async () => {
      setLoading(true);
      const { data, error } = await supabase.auth.getUser();
      console.log('🔍 UserContext - getUser:', { data, error });
      
      if (data?.user) {
        console.log('👤 Usuário autenticado:', data.user.id, data.user.email);
        
        // Buscar dados extras do usuário
        const { data: userData, error: userError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('auth_id', data.user.id)
          .single();
        
        console.log('📋 Dados retornados do Supabase (usuarios):', userData);
        console.log('📋 Busca por auth_id:', { userData, userError });
        
        if (userData && !userError) {
          setUser({
            ...data.user,
            ...userData,
            name: userData.nome, // padroniza para o componente
            deliveryName: userData.nome_delivery, // padroniza para o componente
            createdAt: userData.data_criacao, // mapeia a data de criação
          });
        } else {
          console.log('⚠️ Usuário não encontrado na tabela usuarios, criando...');
          
          // Criar usuário na tabela se não existir
          const { data: newUser, error: insertError } = await supabase
            .from('usuarios')
            .insert([
              {
                auth_id: data.user.id,
                nome: data.user.email?.split('@')[0] || 'Usuário',
                email: data.user.email,
                nome_delivery: 'Meu Delivery',
                senha_hash: null,
                ativo: true
              }
            ])
            .select()
            .single();
            
          if (newUser && !insertError) {
            setUser({
              ...data.user,
              ...newUser,
              name: newUser.nome,
              deliveryName: newUser.nome_delivery,
              createdAt: newUser.data_criacao, // mapeia a data de criação
            });
          } else {
            console.log('❌ Erro ao criar usuário:', insertError);
            setUser(data.user);
          }
        }
      } else {
        console.log('🚫 UserContext - Nenhum usuário autenticado');
        setUser(null);
      }
      setLoading(false);
    };
    getUser();
    // Listener para mudanças de autenticação
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      getUser();
    });
    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, setUser, logout, loading }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser deve ser usado dentro de UserProvider');
  }
  return context;
}; 