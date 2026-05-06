import React, { useState } from 'react';
import styles from './AddPlayer.module.css';

export default function AddPlayer({ onAdd }) {
  const [name, setName] = useState('');

  function submit(e) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    onAdd(v);
    setName('');
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <input
        className={styles.input}
        placeholder="ชื่อผู้เล่น..."
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <button className={styles.btn} type="submit">+ เพิ่มผู้เล่น</button>
    </form>
  );
}
