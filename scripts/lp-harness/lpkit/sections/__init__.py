"""Section registry. Keys are the names used in a page recipe; KIT says which vendo-dental-kit block each one
is built on, so the designers implement against blocks they already have. None = not in the kit yet: the
design flags it for the developers rather than quietly inventing a one-off."""
from .header import header
from .hero_form import hero_form
from .awards import awards
from .usp_text import usp_text
from .story_cards import story_cards
from .pricing import pricing
from .membership import membership
from .google_reviews import google_reviews
from .form_band import form_band
from .pain_points import pain_points
from .treatment import explainer, steps
from .services import services
from .why_us import why_us
from .spotlight import spotlight
from .results import results
from .meet_dentist import meet_dentist
from .team import team
from .practice_tour import practice_tour
from .faq import faq
from .cta import final_cta
from .thank_you import thank_you
from .divider import divider

REGISTRY = dict(header=header, hero_form=hero_form, awards=awards, usp_text=usp_text, story_cards=story_cards,
                pricing=pricing, membership=membership, google_reviews=google_reviews, form_band=form_band,
                pain_points=pain_points, explainer=explainer, steps=steps, services=services, why_us=why_us,
                spotlight=spotlight, results=results, meet_dentist=meet_dentist, team=team,
                practice_tour=practice_tour, faq=faq, final_cta=final_cta, thank_you=thank_you, divider=divider)

KIT = dict(header="vdk/header", hero_form="vdk/hero-form", awards=None, usp_text="vdk/usp-text",
           story_cards="vdk/story-cards", pricing="vdk/pricing-cards", membership=None,
           google_reviews="vdk/google-reviews", form_band=None, pain_points="vdk/pain-points",
           explainer="vdk/treatment", steps="vdk/treatment", services="vdk/services", why_us="vdk/why-us",
           spotlight=None, results="vdk/results", meet_dentist=None, team="vdk/team (post type)",
           practice_tour="vdk/practice-tour", faq="vdk/faq", final_cta="vdk/cta + vdk/footer", thank_you="page", divider=None)
