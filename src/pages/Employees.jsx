import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import {
  UserPlus, Search, MessageCircle, ToggleLeft, ToggleRight, Trash2,
  Users, CheckCircle2, XCircle
} from 'lucide-react';

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const AVATAR_COLORS = [
  'from-brand-400 to-brand-600 text-white',
  'from-emerald-400 to-emerald-600 text-white',
  'from-purple-400 to-purple-600 text-white',
  'from-amber-400 to-amber-600 text-white',
  'from-rose-400 to-rose-600 text-white',
  'from-teal-400 to-teal-600 text-white',
];
function avatarColor(name) {
  const code = [...(name || '')].reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

export default function Employees() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['employees'], queryFn: () => api('/api/employees') });
