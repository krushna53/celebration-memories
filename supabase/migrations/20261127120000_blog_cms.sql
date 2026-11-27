-- Owner-managed public blog content.
create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null default 'Wedding Ideas',
  title text not null,
  excerpt text not null default '',
  date_label text not null default '',
  read_time text not null default '5 min read',
  image_url text not null default '',
  image_alt text not null default '',
  tags text[] not null default '{}',
  sections jsonb not null default '[]'::jsonb,
  quote text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_public_order_idx
  on public.blog_posts (published, sort_order);

alter table public.blog_posts enable row level security;
revoke all on public.blog_posts from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-assets', 'blog-assets', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Seed the existing hand-written stories. Existing posts remain published.
insert into public.blog_posts
  (slug, category, title, excerpt, date_label, read_time, image_url, image_alt, tags, sections, quote, published, sort_order)
values
('dreamy-wedding-decoration-ideas','Wedding Ideas','Dreamy Wedding Decoration Ideas for Your Big Day','From floral mandaps to elegant lighting, find thoughtful details that make your celebration feel like you.','Nov 25, 2026','5 min read','/wedding-demo-royal.webp','A flower-framed mandap glowing with warm lights',array['Wedding Ideas','Decor'], '[{"heading":"Create a floral focal point","body":"A mandap, ceremony arch, or entrance framed with flowers gives your celebration a natural centrepiece. Choose blooms that are in season and repeat a few of them across the tables for a look that feels considered."},{"heading":"Let lighting set the mood","body":"Warm fairy lights, candles, and shaded lamps bring a soft glow to an evening celebration. Layer a few types of light so guests can see comfortably while the room still feels intimate."},{"heading":"Choose a palette with meaning","body":"Start with colours you already love, then add one accent from your venue or family traditions. Repeating that palette in flowers, linens, and stationery helps each part of the day feel connected."}]'::jsonb,'A beautiful wedding is made of the little details that feel like you.',true,10),
('digital-invitations-that-feel-personal','Invitations','Digital Invitations That Still Feel Personal','A few small choices can turn a convenient online invitation into a warm, memorable first hello.','Nov 20, 2026','4 min read','/art/couples/couple-lotus-dawn.webp','A couple sharing a quiet moment at sunrise',array['Invitations'], '[{"heading":"Open with your story","body":"A short note in your own voice makes an invitation feel like it came from you. Share what you are celebrating and why having your guest there matters."},{"heading":"Make the details easy to find","body":"Keep the date, time, venue, and RSVP action clear and close together. Guests should be able to check the essentials in a few seconds on their phone."},{"heading":"Add one personal touch","body":"A favourite photo, a meaningful song, or a line from your family tradition is often enough. A personal detail can make a simple design feel truly yours."}]'::jsonb,null,true,20),
('from-first-hello-to-forever','Love Stories','From First Hello to Forever','A gentle guide to collecting the moments and memories that make your celebration uniquely yours.','Nov 18, 2026','4 min read','/art/couples/couple-orchid-evening.webp','A couple together beneath an evening sky',array['Love Stories'], '[{"heading":"Keep the small moments","body":"The story is often in the in-between: a shared laugh while getting ready, a quiet family blessing, or friends meeting again. Make space for these alongside the big milestones."},{"heading":"Invite loved ones to add their memories","body":"Ask family and friends to share a photo or a short note. Their perspectives become a lovely companion to the photographs you planned."},{"heading":"Give yourself time to enjoy it","body":"A relaxed timeline leaves room for the day to unfold. Build in a few pauses, and let someone you trust handle the small logistics."}]'::jsonb,'The best stories are the ones everyone helps you remember.',true,30),
('bridal-looks-to-inspire-you','Wedding Ideas','Bridal Looks to Inspire You','Find a bridal style that feels comfortable, expressive, and completely your own.','Nov 15, 2026','5 min read','/art/couples/couple-rajasthani-gulabi.webp','Traditional wedding attire in warm rose and gold tones',array['Wedding Ideas','Bridal'], '[{"heading":"Start with how you want to feel","body":"Before choosing a look, picture how you want to move through the day. Comfort and confidence are as important as colour, embroidery, or silhouette."},{"heading":"Bring tradition into your own style","body":"A family heirloom, a familiar motif, or a contemporary colour can help your outfit feel personal while honouring the moments and people that matter to you."},{"heading":"Try the whole look together","body":"Wear your chosen shoes and jewellery during a fitting. A full rehearsal makes it easier to spot adjustments and enjoy the day without fuss."}]'::jsonb,null,true,40),
('beautiful-haldi-celebration-ideas','Celebrations','Beautiful Haldi Celebration Ideas','Bring family, colour, and a little sunshine together for a joyful Haldi celebration.','Nov 12, 2026','4 min read','/art/couples/couple-tamil-jasmine.webp','A colourful and joyful Indian wedding celebration',array['Celebrations','Haldi'], '[{"heading":"Keep the gathering relaxed","body":"Set up a comfortable area with shade, water, and room for family to gather. A simple layout makes it easier for everyone to be part of the ceremony."},{"heading":"Use marigolds and bright accents","body":"Fresh flowers, colourful cushions, and a few handmade signs can make a welcoming backdrop without overcomplicating the setup."},{"heading":"Plan for keepsake photos","body":"Choose one well-lit corner for portraits and keep a towel or shawl nearby. Guests can take turns sharing candid moments without interrupting the ceremony."}]'::jsonb,null,true,50),
('wedding-film-reel-ideas','AI Videos','Wedding Film Reel Ideas to Keep the Feeling','Turn a few favourite photos and little details into a short film you will love sharing.','Nov 11, 2026','4 min read','/videos/stories/story-1.jpg','A wedding memory captured as a short film',array['AI Videos','Reels'], '[{"heading":"Choose moments that tell one story","body":"A short reel feels more personal when its photos and clips follow a simple idea: getting ready, the ceremony, or a favourite family moment. Choose a few strong scenes instead of trying to include everything."},{"heading":"Keep the words and music simple","body":"A date, a name, or a short line can add context without covering the image. Pick music that feels right for you and check that it is suitable for the place you plan to share the video."},{"heading":"Make it easy to watch on a phone","body":"Vertical framing, readable captions, and a concise runtime help friends and family enjoy the reel wherever they are."}]'::jsonb,null,true,60),
('the-magic-of-mehendi-ceremony','Traditions','The Magic of a Mehendi Ceremony','Celebrate the artistry, music, and togetherness at the heart of a Mehendi gathering.','Nov 10, 2026','5 min read','/art/couples/couple-rosewood-vows.webp','Intricate henna-inspired wedding details',array['Traditions','Mehendi'], '[{"heading":"Make room for the artist","body":"A comfortable seat, steady light, and a small table nearby help the Mehendi artist work with ease. Leave enough time so the celebration can stay unhurried."},{"heading":"Gather around the ritual","body":"Music, stories, and a few favourite snacks make the waiting time part of the celebration. Invite loved ones to share a song or a memory."},{"heading":"Keep the schedule flexible","body":"Henna takes time to apply and dry. A relaxed schedule lets guests come and go while keeping the focus on enjoying each other''s company."}]'::jsonb,'Tradition lives in the moments we share together.',true,70)
on conflict (slug) do nothing;
