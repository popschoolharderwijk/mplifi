import { GiGuitarBassHead, GiSaxophone } from 'react-icons/gi';
import { HiUserGroup } from 'react-icons/hi';
import {
	LuAudioWaveform,
	LuDrum,
	LuGuitar,
	LuHeadphones,
	LuMic,
	LuMusic,
	LuMusic2,
	LuMusic3,
	LuMusic4,
	LuPiano,
	LuSpeaker,
} from 'react-icons/lu';
import type { IconList } from '@/components/ui/icon-picker';

const icon = <T>(component: T, label: string) => ({ component, label });

/** Music/instrument related icons for lesson types */
export const MUSIC_ICONS = {
	LuGuitar: icon(LuGuitar, 'Gitaar'),
	GiGuitarBassHead: icon(GiGuitarBassHead, 'Basgitaar'),
	LuDrum: icon(LuDrum, 'Drums'),
	LuMic: icon(LuMic, 'Microfoon'),
	LuMusic: icon(LuMusic, 'Muziek'),
	LuMusic2: icon(LuMusic2, 'Muziek 2'),
	LuMusic3: icon(LuMusic3, 'Muziek 3'),
	LuMusic4: icon(LuMusic4, 'Muziek 4'),
	LuPiano: icon(LuPiano, 'Piano'),
	GiSaxophone: icon(GiSaxophone, 'Saxofoon'),
	LuHeadphones: icon(LuHeadphones, 'DJ / Beats'),
	HiUserGroup: icon(HiUserGroup, 'Groep'),
	LuAudioWaveform: icon(LuAudioWaveform, 'Golfvorm'),
	LuSpeaker: icon(LuSpeaker, 'Speaker'),
} satisfies IconList;
