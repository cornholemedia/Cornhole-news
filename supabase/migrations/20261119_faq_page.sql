-- FAQ page. Starter questions the owner can rewrite from /admin.
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Safe to run more than once. Does not replace a FAQ that was already saved.

alter table public.pages drop constraint if exists pages_slug_check;
alter table public.pages add constraint pages_slug_check
  check (slug in ('about', 'faq', 'jobs', 'advertise', 'privacy', 'terms', 'contact'));

insert into public.pages (slug, title, subtitle, body)
values (
  'faq',
  'FAQ',
  'Answers to common questions about Cornhole News.',
  $faq$## What is Cornhole News?

Cornhole News is a community news and discussion site for the 12 Midwestern states: Illinois, Indiana, Iowa, Kansas, Michigan, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota, and Wisconsin.

## Why the name?

It is named for cornhole, the lawn game at Midwest tailgates and backyard parties. Yes, we know.

## Which states are covered?

Those 12 states. Canada is not included. Manitoba and Ontario are outside the site for now.

## Where do the stories come from?

Readers submit them. There is also a daily roundup of Midwest news. The editor reads that roundup and publishes each story by hand. Nothing from the roundup goes live on its own.

## How do you decide what is tagged Politics?

A story that is mainly about elections, candidates, elected officials, government bodies, parties, or legislation gets the Politics tag. The person who submits a story can mark it, and the editor marks stories in the daily roundup. It is a judgment call, and it is not perfect. The Show politics switch on the Top page hides tagged stories there. If one looks mislabeled, tell us on the [contact page](/contact).

## How do I hide politics?

Use the Show politics switch at the top of the Top page. Turn it off and those stories drop off that list. The New page is still newest first, politics included.

## Can I filter stories by state?

Not yet. That is on the list. The [jobs page](/jobs) can filter job openings by state.

## Is there an RSS feed?

Yes. The feed is at [/rss.xml](/rss.xml). [/feed](/feed) is the same feed.

## How does ranking work?

The Top page lists stories from the last 72 hours first, most votes at the top. The same number of votes puts the newer story first. Older stories follow that whole group, also by votes. The New page is newest first. A vote is an upvote, and you can take it back.

## How is the site moderated?

The site owner moderates. Off-topic, spam, and abusive posts and comments are removed. The rules are in the [terms of use](/terms).

## Will there be ads?

The plan is small ads for Midwestern businesses, to cover the cost of keeping the site up. That is two sidebar spots and a short banner on phones. No ad networks and no tracking ads. A business that wants one of those spots can write through the [contact page](/contact).

## Is it open source?

Yes. The code is on GitHub at [github.com/cornholemedia/Cornhole-news](https://github.com/cornholemedia/Cornhole-news).

## How do I post a job?

Posting is free at [/jobs/post](/jobs/post). A listing is reviewed before it goes live, and an approved job stays up for 30 days.

## How do I contact you?

Use the [contact page](/contact). We read every message.$faq$
)
on conflict (slug) do nothing;
